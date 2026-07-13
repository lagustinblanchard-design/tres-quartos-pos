/**
 * Lógica pura (sin I/O, sin Prisma) para parsear el "Cuadro de Pedido" que
 * envía el proveedor (IMAGO Indumentarias) y convertirlo en líneas de
 * compra. Separado de la ruta de API para poder testearlo sin base de
 * datos ni archivos reales — mismo patrón que import-inventory-lib.ts.
 *
 * Formato real del archivo (relevado en `IMAGO Cuadro Pedido Junio 2026.xls`,
 * hoja "Hoja1"): es una matriz con MÚLTIPLES secciones, no una tabla plana.
 * Cada sección tiene:
 *   - una fila de categoría: col0 = nombre de categoría (ej. "CAMISETAS",
 *     "SHORTS RUGBY", "PELOTAS N° 5"), col1 vacío.
 *   - una fila de encabezado propia: col0="MODELOS", col1="CODIGO", y desde
 *     col2 en adelante los talles disponibles PARA ESA SECCIÓN (varían:
 *     algunas secciones tienen 8/10/12/14/XS..4XL, otras solo XS-XL, otras
 *     usan "CANT" para productos sin talle como pelotas).
 *   - filas de producto: col0=nombre, col1=CODIGO del proveedor, y en cada
 *     columna de talle la cantidad a pedir (vacío/0 si no se pide ese
 *     talle — el pedido real solo completa una fracción del catálogo).
 *
 * El precio de costo NO se parsea desde este archivo: las columnas de
 * precio son por rango de talle (NIÑOS/ADULTOS/ESPECIAL) sin una regla
 * fija de qué talles caen en qué rango por sección, así que se carga a
 * mano al confirmar la recepción (igual que hoy en compras.py).
 */

import { buildProductSku, buildVariantSku } from "./import-inventory-lib";

export const TALLAS_VALIDAS = new Set([
  "8", "10", "12", "14", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL",
]);

const TALLA_UNICA = "";

export interface SupplierOrderLine {
  codigo: string;
  nombre: string;
  categoria: string;
  talla: string;
  cantidad: number;
}

export interface InvalidSupplierRow {
  fila: number;
  codigo: string;
  nombre: string;
  motivo: string;
}

export interface ParsedSupplierOrder {
  lines: SupplierOrderLine[];
  invalid: InvalidSupplierRow[];
  duplicateCodigos: string[];
}

function normalizeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** "1001.0" → "1001" (Excel puede formatear códigos numéricos como float). */
function normalizeCodigo(v: unknown): string {
  const s = normalizeCell(v);
  const f = Number(s);
  if (s && Number.isFinite(f) && f === Math.trunc(f)) return String(Math.trunc(f));
  return s;
}

function isHeaderRow(row: unknown[]): boolean {
  return normalizeCell(row[0]).toUpperCase() === "MODELOS" && normalizeCell(row[1]).toUpperCase() === "CODIGO";
}

/** Mapea índice de columna → talla, a partir de la fila de encabezado de una sección. */
function detectTallaColumns(row: unknown[]): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 2; i < row.length; i++) {
    const label = normalizeCell(row[i]).toUpperCase();
    if (TALLAS_VALIDAS.has(label)) {
      map.set(i, label);
    } else if (label === "CANT") {
      map.set(i, TALLA_UNICA); // producto sin talle (ej. pelotas)
    }
  }
  return map;
}

/**
 * Parsea la matriz completa (una hoja leída como array-de-arrays, ej. con
 * `XLSX.utils.sheet_to_json(sheet, { header: 1 })`). Solo emite líneas para
 * combinaciones producto×talle con cantidad > 0 — el pedido real rara vez
 * cubre todo el catálogo del proveedor.
 */
export function parseSupplierOrderSheet(matrix: unknown[][]): ParsedSupplierOrder {
  const lines: SupplierOrderLine[] = [];
  const invalid: InvalidSupplierRow[] = [];
  const primeraAparicion = new Map<string, number>();
  const duplicados = new Set<string>();

  let categoriaActual = "";
  let tallaColumns = new Map<number, string>();

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const col0 = normalizeCell(row[0]);
    const col1raw = row[1];
    const col1 = normalizeCell(col1raw);

    if (!col0 && !col1) continue; // fila vacía separadora

    if (isHeaderRow(row)) {
      tallaColumns = detectTallaColumns(row);
      continue;
    }

    if (col0 && !col1) {
      // Fila de categoría. También matchea el título inicial ("CUADRO
      // PEDIDO JUNIO") y las firmas finales ("PREPARÓ:") — inocuo: al
      // título lo pisa la categoría real de la fila siguiente, y a las
      // firmas no las sigue ninguna fila de producto.
      categoriaActual = col0;
      continue;
    }

    if (!col0 || !col1) continue; // sin nombre o sin código (ej. texto suelto de membrete) — no es una fila de producto

    const codigo = normalizeCodigo(col1raw);
    const nombre = col0;

    if (primeraAparicion.has(codigo)) {
      duplicados.add(codigo);
    } else {
      primeraAparicion.set(codigo, r);
    }

    if (tallaColumns.size === 0) {
      invalid.push({ fila: r, codigo, nombre, motivo: "sin encabezado de talles detectado para esta sección" });
      continue;
    }

    for (const [colIdx, talla] of tallaColumns) {
      const cantidad = Number(row[colIdx]);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue; // no se pide este talle
      lines.push({ codigo, nombre, categoria: categoriaActual, talla, cantidad: Math.trunc(cantidad) });
    }
  }

  return { lines, invalid, duplicateCodigos: [...duplicados] };
}

export interface ExistingSupplierProduct {
  id: string;
  sku: string;
  variantsByTalla: Map<string, { id: string; sku: string }>;
}

export type OrderPlanItemKind = "matched" | "variante-nueva" | "producto-nuevo" | "codigo-duplicado";

export interface OrderPlanItem extends SupplierOrderLine {
  kind: OrderPlanItemKind;
  productId?: string;
  variantId?: string;
  proposedSku?: string;
}

/**
 * Cruza las líneas parseadas contra el catálogo existente (indexado por
 * `supplierCode`) y clasifica cada línea:
 *  - `matched`: producto y variante (talle) ya existen — recepción directa.
 *  - `variante-nueva`: el producto existe (código conocido) pero el talle
 *    pedido no tiene variante todavía — se crea al confirmar.
 *  - `producto-nuevo`: código no visto antes — se crea producto + variante.
 *  - `codigo-duplicado`: el código aparece más de una vez en el archivo
 *    (dato del proveedor inconsistente) — requiere resolución manual, no
 *    se autoresuelve para no mezclar dos productos distintos.
 */
export function buildOrderPlan(
  lines: SupplierOrderLine[],
  duplicateCodigos: string[],
  existingBySupplierCode: Map<string, ExistingSupplierProduct>
): OrderPlanItem[] {
  const dupSet = new Set(duplicateCodigos);

  return lines.map((line) => {
    if (dupSet.has(line.codigo)) {
      return { ...line, kind: "codigo-duplicado" };
    }

    const producto = existingBySupplierCode.get(line.codigo);
    const tallaKey = line.talla.toUpperCase() || "UNICA";

    if (!producto) {
      return {
        ...line,
        kind: "producto-nuevo",
        proposedSku: buildVariantSku(line.categoria, line.nombre, line.talla || "UNICA"),
      };
    }

    const variante = producto.variantsByTalla.get(tallaKey);
    if (variante) {
      return { ...line, kind: "matched", productId: producto.id, variantId: variante.id };
    }

    return {
      ...line,
      kind: "variante-nueva",
      productId: producto.id,
      proposedSku: `${producto.sku}-${tallaKey}`,
    };
  });
}

export { buildProductSku };
