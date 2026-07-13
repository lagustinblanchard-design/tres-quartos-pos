import { describe, it, expect } from "vitest";
import {
  slugify,
  categoryCode,
  buildProductSku,
  buildVariantSku,
  parseRows,
  buildImportPlan,
  renderReport,
} from "../import-inventory-lib";

describe("slugify / categoryCode / SKU", () => {
  it("normaliza acentos y espacios", () => {
    expect(slugify("Camiseta Lions México")).toBe("camiseta-lions-mexico");
  });

  it("genera un código de 3 letras por categoría", () => {
    expect(categoryCode("Rugby")).toBe("RUG");
    expect(categoryCode("Pádel")).toBe("PAD");
  });

  it("categoría vacía cae a GEN", () => {
    expect(categoryCode("")).toBe("GEN");
  });

  it("construye el SKU de variante con el formato TQ-<CAT>-<slug>-<TALLA>", () => {
    expect(buildVariantSku("Rugby", "Camiseta Lions", "xl")).toBe("TQ-RUG-camiseta-lions-XL");
    expect(buildProductSku("Rugby", "Camiseta Lions")).toBe("TQ-RUG-camiseta-lions");
  });

  it("el SKU es estable entre ejecuciones (mismos inputs → mismo SKU)", () => {
    const a = buildVariantSku("Pádel", "Paleta Pro", "U");
    const b = buildVariantSku("Pádel", "Paleta Pro", "U");
    expect(a).toBe(b);
  });
});

describe("parseRows", () => {
  it("acepta filas válidas", () => {
    const { valid, invalid } = parseRows([
      { nombre: "Camiseta Lions", categoria: "Rugby", talla: "M", stock: 5, precio_venta: 15000, precio_costo: 8000 },
    ]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it("el código de proveedor es opcional", () => {
    const { valid } = parseRows([
      { nombre: "Camiseta Lions", categoria: "Rugby", talla: "M", stock: 5, precio_venta: 15000, codigo: "1001" },
      { nombre: "Camiseta Sin Codigo", categoria: "Rugby", talla: "M", stock: 5, precio_venta: 15000 },
    ]);
    expect(valid[0].codigo).toBe("1001");
    expect(valid[1].codigo).toBeUndefined();
  });

  it("rechaza filas sin precio detectado", () => {
    const { valid, invalid } = parseRows([
      { nombre: "Camiseta X", categoria: "Rugby", talla: "M", stock: 5, precio_venta: 0, precio_costo: 0 },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid).toEqual([{ row: { nombre: "Camiseta X", categoria: "Rugby", talla: "M" }, motivo: "precio no detectado" }]);
  });

  it("rechaza filas con stock inválido", () => {
    const { valid, invalid } = parseRows([
      { nombre: "Camiseta X", categoria: "Rugby", talla: "M", stock: 0, precio_venta: 100, precio_costo: 0 },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid[0].motivo).toBe("stock inválido o cero");
  });

  it("rechaza filas sin nombre/categoría/talla", () => {
    const { invalid } = parseRows([
      { nombre: "", categoria: "Rugby", talla: "M", stock: 1, precio_venta: 100 },
      { nombre: "X", categoria: "", talla: "M", stock: 1, precio_venta: 100 },
      { nombre: "X", categoria: "Rugby", talla: "", stock: 1, precio_venta: 100 },
    ]);
    expect(invalid.map((i) => i.motivo)).toEqual(["nombre vacío", "categoría vacía", "talla vacía"]);
  });
});

describe("buildImportPlan", () => {
  const rows = [
    { nombre: "Camiseta Lions", categoria: "Rugby", talla: "M", stock: 5, precio_venta: 15000, precio_costo: 8000 },
    { nombre: "Camiseta Lions", categoria: "Rugby", talla: "L", stock: 3, precio_venta: 15000, precio_costo: 8000 },
  ];

  it("marca todas las variantes de un producto no visto como nuevo-producto / nueva-variante", () => {
    const plan = buildImportPlan(rows, new Map(), new Set());
    expect(plan.items[0].kind).toBe("nuevo-producto");
    expect(plan.items[1].kind).toBe("nueva-variante"); // mismo producto, segunda talla
    expect(plan.resumen.productosNuevos).toBe(1);
    expect(plan.resumen.variantesNuevas).toBe(2);
  });

  it("detecta variante existente con diferencia de stock (requiere verificación física)", () => {
    const sku = buildVariantSku("Rugby", "Camiseta Lions", "M");
    const existing = new Map([[sku, { stock: 8, price: 15000 }]]);
    const plan = buildImportPlan(rows, existing, new Set([buildProductSku("Rugby", "Camiseta Lions")]));

    const item = plan.items.find((i) => i.sku === sku)!;
    expect(item.kind).toBe("variante-existente");
    expect(item.diffStock).toBe(5 - 8);
    expect(item.requiereVerificacionFisica).toBe(true);
    expect(plan.resumen.variantesConDiferencia).toBe(1);
  });

  it("variante existente sin diferencia no requiere verificación física", () => {
    const sku = buildVariantSku("Rugby", "Camiseta Lions", "M");
    const existing = new Map([[sku, { stock: 5, price: 15000 }]]);
    const plan = buildImportPlan(rows, existing, new Set([buildProductSku("Rugby", "Camiseta Lions")]));
    const item = plan.items.find((i) => i.sku === sku)!;
    expect(item.requiereVerificacionFisica).toBe(false);
  });

  it("propaga el código de proveedor cuando está presente", () => {
    const conCodigo = rows.map((r) => ({ ...r, codigo: "1001" }));
    const plan = buildImportPlan(conCodigo, new Map(), new Set());
    expect(plan.items.every((i) => i.codigo === "1001")).toBe(true);
    expect(plan.items.every((i) => !i.codigoConflicto)).toBe(true);
    expect(plan.resumen.codigosConflicto).toBe(0);
  });

  it("detecta conflicto cuando el mismo producto trae dos códigos distintos en el archivo", () => {
    const conConflicto = [
      { ...rows[0], codigo: "1001" },
      { ...rows[1], codigo: "1002" }, // mismo producto (nombre+categoría), otro código
    ];
    const plan = buildImportPlan(conConflicto, new Map(), new Set());
    expect(plan.items[0].codigoConflicto).toBe(false);
    expect(plan.items[1].codigoConflicto).toBe(true);
    expect(plan.resumen.codigosConflicto).toBe(1);
  });
});

describe("renderReport", () => {
  it("incluye el resumen y las secciones relevantes", () => {
    const plan = buildImportPlan(
      [{ nombre: "Camiseta Lions", categoria: "Rugby", talla: "M", stock: 5, precio_venta: 15000, precio_costo: 8000 }],
      new Map(),
      new Set()
    );
    const report = renderReport(plan, [], "stock.xlsx");
    expect(report).toContain("Productos nuevos: 1");
    expect(report).toContain("stock.xlsx");
  });

  it("lista los códigos de proveedor en conflicto", () => {
    const conConflicto = [
      { nombre: "Camiseta Lions", categoria: "Rugby", talla: "M", stock: 5, precio_venta: 15000, precio_costo: 0, codigo: "1001" },
      { nombre: "Camiseta Lions", categoria: "Rugby", talla: "L", stock: 3, precio_venta: 15000, precio_costo: 0, codigo: "1002" },
    ];
    const plan = buildImportPlan(conConflicto, new Map(), new Set());
    const report = renderReport(plan, [], "stock.xlsx");
    expect(report).toContain("Códigos de proveedor en conflicto");
    expect(report).toContain("1002");
  });
});
