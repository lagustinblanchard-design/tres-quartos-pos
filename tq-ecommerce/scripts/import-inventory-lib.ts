/**
 * Lógica pura del importador de inventario (sin I/O, sin Prisma) — separada
 * de import-inventory.ts para poder testearla sin una base de datos ni
 * archivos reales. Ver design.md §D6 y specs/inventory-import/spec.md.
 */

export interface ExcelRow {
  nombre: string;
  codigo?: string;
  categoria: string;
  talla: string;
  stock: number;
  precio_venta: number;
  precio_costo: number;
}

export interface InvalidRow {
  row: Partial<ExcelRow>;
  motivo: string;
}

/** Normaliza texto: minúsculas, sin acentos, separado por guiones. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (marcas diacríticas tras NFD)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Código de 3 letras derivado de la categoría (ej. "Rugby" → "RUG"). */
export function categoryCode(categoria: string): string {
  const slug = slugify(categoria).replace(/-/g, "");
  if (!slug) return "GEN";
  return slug.slice(0, 3).toUpperCase().padEnd(3, "X");
}

/** SKU a nivel producto: TQ-<CAT>-<slug-producto> */
export function buildProductSku(categoria: string, nombre: string): string {
  return `TQ-${categoryCode(categoria)}-${slugify(nombre)}`;
}

/** SKU a nivel variante: TQ-<CAT>-<slug-producto>-<TALLA> */
export function buildVariantSku(categoria: string, nombre: string, talla: string): string {
  const talla_norm = String(talla).trim().toUpperCase();
  return `${buildProductSku(categoria, nombre)}-${talla_norm}`;
}

export function productSlug(categoria: string, nombre: string): string {
  return `${categoryCode(categoria).toLowerCase()}-${slugify(nombre)}`;
}

/**
 * Valida y separa las filas del Excel plano (salida de convertir_excel.py)
 * en válidas e inválidas. No asume nada sobre la fuente (array de objetos
 * ya parseados desde la hoja).
 */
export function parseRows(raw: Record<string, unknown>[]): { valid: ExcelRow[]; invalid: InvalidRow[] } {
  const valid: ExcelRow[] = [];
  const invalid: InvalidRow[] = [];

  for (const r of raw) {
    const nombre = String(r.nombre ?? "").trim();
    const codigo = String(r.codigo ?? "").trim();
    const categoria = String(r.categoria ?? "").trim();
    const talla = String(r.talla ?? "").trim();
    const stock = Number(r.stock);
    const precioVenta = Number(r.precio_venta);
    const precioCosto = Number(r.precio_costo ?? 0);

    if (!nombre) {
      invalid.push({ row: r, motivo: "nombre vacío" });
      continue;
    }
    if (!categoria) {
      invalid.push({ row: r, motivo: "categoría vacía" });
      continue;
    }
    if (!talla) {
      invalid.push({ row: r, motivo: "talla vacía" });
      continue;
    }
    if (!Number.isFinite(stock) || stock <= 0) {
      invalid.push({ row: r, motivo: "stock inválido o cero" });
      continue;
    }
    if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
      invalid.push({ row: { nombre, categoria, talla }, motivo: "precio no detectado" });
      continue;
    }

    valid.push({
      nombre,
      codigo: codigo || undefined,
      categoria,
      talla,
      stock: Math.trunc(stock),
      precio_venta: precioVenta,
      precio_costo: Number.isFinite(precioCosto) ? precioCosto : 0,
    });
  }

  return { valid, invalid };
}

export interface ExistingVariant {
  stock: number;
  price: number;
}

export type ImportItemKind = "nuevo-producto" | "nueva-variante" | "variante-existente";

export interface ImportPlanItem {
  sku: string;
  productSku: string;
  nombre: string;
  codigo?: string;
  categoria: string;
  talla: string;
  stockExcel: number;
  precioVenta: number;
  precioCosto: number;
  kind: ImportItemKind;
  stockActual?: number;
  diffStock?: number;
  diffPrecio?: number;
  requiereVerificacionFisica: boolean;
  /** El mismo producto (por nombre+categoría) trae más de un código de proveedor distinto en el archivo. */
  codigoConflicto?: boolean;
}

export interface ImportPlan {
  items: ImportPlanItem[];
  invalid: InvalidRow[];
  resumen: {
    productosNuevos: number;
    variantesNuevas: number;
    variantesConDiferencia: number;
    filasInvalidas: number;
    codigosConflicto: number;
  };
}

/**
 * Construye el plan de importación: para cada fila válida determina si es
 * producto nuevo, variante nueva de un producto existente, o variante
 * existente con (posible) diferencia de stock/precio contra la base
 * canónica. No escribe nada — es la base del reporte de dry-run.
 */
export function buildImportPlan(
  rows: ExcelRow[],
  existingVariantsBySku: Map<string, ExistingVariant>,
  existingProductSkus: Set<string>
): ImportPlan {
  const items: ImportPlanItem[] = [];
  const seenProductSkusThisRun = new Set<string>();
  const codigoPorProducto = new Map<string, string>();
  let productosNuevos = 0;
  let variantesNuevas = 0;
  let variantesConDiferencia = 0;
  let codigosConflicto = 0;

  for (const row of rows) {
    const sku = buildVariantSku(row.categoria, row.nombre, row.talla);
    const productSku = buildProductSku(row.categoria, row.nombre);

    const existingVariant = existingVariantsBySku.get(sku);
    const productExists = existingProductSkus.has(productSku) || seenProductSkusThisRun.has(productSku);

    let kind: ImportItemKind;
    let stockActual: number | undefined;
    let diffStock: number | undefined;
    let diffPrecio: number | undefined;
    let requiereVerificacionFisica = false;

    if (existingVariant) {
      kind = "variante-existente";
      stockActual = existingVariant.stock;
      diffStock = row.stock - existingVariant.stock;
      diffPrecio = row.precio_venta - existingVariant.price;
      if (diffStock !== 0) {
        variantesConDiferencia++;
        requiereVerificacionFisica = true;
      }
    } else if (productExists) {
      kind = "nueva-variante";
      variantesNuevas++;
    } else {
      kind = "nuevo-producto";
      productosNuevos++;
      variantesNuevas++;
    }

    seenProductSkusThisRun.add(productSku);

    let codigoConflicto = false;
    if (row.codigo) {
      const previo = codigoPorProducto.get(productSku);
      if (previo === undefined) {
        codigoPorProducto.set(productSku, row.codigo);
      } else if (previo !== row.codigo) {
        codigoConflicto = true;
        codigosConflicto++;
      }
    }

    items.push({
      sku,
      productSku,
      nombre: row.nombre,
      codigo: row.codigo,
      categoria: row.categoria,
      talla: row.talla,
      stockExcel: row.stock,
      precioVenta: row.precio_venta,
      precioCosto: row.precio_costo,
      kind,
      stockActual,
      diffStock,
      diffPrecio,
      requiereVerificacionFisica,
      codigoConflicto,
    });
  }

  return {
    items,
    invalid: [],
    resumen: {
      productosNuevos,
      variantesNuevas,
      variantesConDiferencia,
      filasInvalidas: 0,
      codigosConflicto,
    },
  };
}

export function renderReport(plan: ImportPlan, invalid: InvalidRow[], fileName: string): string {
  const lines: string[] = [];
  lines.push(`# Reporte de importación de inventario`);
  lines.push("");
  lines.push(`Archivo: \`${fileName}\``);
  lines.push("");
  lines.push(`## Resumen`);
  lines.push("");
  lines.push(`- Productos nuevos: ${plan.resumen.productosNuevos}`);
  lines.push(`- Variantes nuevas: ${plan.resumen.variantesNuevas}`);
  lines.push(`- Variantes con diferencia de stock (requieren conteo físico): ${plan.resumen.variantesConDiferencia}`);
  lines.push(`- Filas inválidas: ${invalid.length}`);
  if (plan.resumen.codigosConflicto > 0) {
    lines.push(`- Códigos de proveedor en conflicto dentro del archivo (no se mapean): ${plan.resumen.codigosConflicto}`);
  }
  lines.push("");

  const nuevos = plan.items.filter((i) => i.kind !== "variante-existente");
  if (nuevos.length) {
    lines.push(`## Altas (productos/variantes nuevas)`);
    lines.push("");
    lines.push(`| SKU | Producto | Talla | Stock | Precio | Tipo |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const i of nuevos) {
      lines.push(`| ${i.sku} | ${i.nombre} | ${i.talla} | ${i.stockExcel} | ${i.precioVenta} | ${i.kind} |`);
    }
    lines.push("");
  }

  const diffs = plan.items.filter((i) => i.kind === "variante-existente" && i.requiereVerificacionFisica);
  if (diffs.length) {
    lines.push(`## Diferencias de stock — requieren verificación física antes de --apply`);
    lines.push("");
    lines.push(`| SKU | Producto | Talla | Stock actual | Stock Excel | Diferencia |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const i of diffs) {
      lines.push(
        `| ${i.sku} | ${i.nombre} | ${i.talla} | ${i.stockActual} | ${i.stockExcel} | ${i.diffStock! > 0 ? "+" : ""}${i.diffStock} |`
      );
    }
    lines.push("");
  }

  const priceDiffs = plan.items.filter((i) => i.kind === "variante-existente" && i.diffPrecio && i.diffPrecio !== 0);
  if (priceDiffs.length) {
    lines.push(`## Diferencias de precio`);
    lines.push("");
    lines.push(`| SKU | Precio actual | Precio Excel |`);
    lines.push(`|---|---|---|`);
    for (const i of priceDiffs) {
      lines.push(`| ${i.sku} | ${i.precioVenta - i.diffPrecio!} | ${i.precioVenta} |`);
    }
    lines.push("");
  }

  const conflictos = plan.items.filter((i) => i.codigoConflicto);
  if (conflictos.length) {
    lines.push(`## Códigos de proveedor en conflicto — no se mapean automáticamente`);
    lines.push("");
    lines.push(`| SKU | Producto | Código en el archivo |`);
    lines.push(`|---|---|---|`);
    for (const i of conflictos) {
      lines.push(`| ${i.sku} | ${i.nombre} | ${i.codigo ?? ""} |`);
    }
    lines.push("");
  }

  if (invalid.length) {
    lines.push(`## Filas inválidas`);
    lines.push("");
    lines.push(`| Fila | Motivo |`);
    lines.push(`|---|---|`);
    for (const inv of invalid) {
      lines.push(`| ${JSON.stringify(inv.row)} | ${inv.motivo} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
