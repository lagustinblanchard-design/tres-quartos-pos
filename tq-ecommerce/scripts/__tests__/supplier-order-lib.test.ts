import { describe, it, expect } from "vitest";
import { parseSupplierOrderSheet, buildOrderPlan, type ExistingSupplierProduct } from "../supplier-order-lib";

// Fixture recortada del archivo real "IMAGO Cuadro Pedido Junio 2026.xls"
// (hoja "Hoja1"), preservando lo que hace compleja la estructura:
// - encabezado propio por sección, con distinto set de talles cada vez
// - una sección "sin talle" (pelotas) que usa la columna "CANT"
// - un código de proveedor duplicado dentro del mismo archivo (dato real)
// - filas sin cantidad pedida (la mayoría del catálogo no se pide)
const FIXTURE: unknown[][] = [
  [],
  [undefined, "IMAGO INDUMENTARIAS S.A."],
  ["CUADRO PEDIDO JUNIO"],
  ["CAMISETAS"],
  ["MODELOS", "CODIGO", "8", "10", "12", "14", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "NIÑOS", "ADULTOS", "ESPECIAL", "TOTAL"],
  ["ARGENTINA AZUL #850", 1001, "", "", "", "", "", "", "", "", "", "", "", "", 27560, 29680, 33920, 0],
  ["ARGENTINA CELESTE Y BLANCO #950", 1002, "", "", "", "", 1, 1, 1, 1, 1, 1, "", "", 27560, 29680, 33920, 178080],
  [],
  ["BOXERS"],
  ["MODELOS", "CODIGO", "", "", "", "", "", "S", "M", "L", "XL", "2XL", "3XL", "", "NIÑOS", "ADULTOS", "ESPECIAL", "TOTAL"],
  ["ALL BLACKS NEGRO #505", 5300, "", "", "", "", "", "", 2, "", "", "", "", "", 0, 10165.95, 10165.95, 20331.9],
  [],
  ["PELOTAS N° 5"],
  ["MODELOS", "CODIGO", "", "CANT", "", "", "", "", "", "", "", "", "", "", "PRECIO", "", "", "TOTAL"],
  ["ALL BLACKS", 7000, "", 3, "", "", "", "", "", "", "", "", "", "", 31242.1, 0, 0, 93726.3],
  ["MAORI ROJA", 7001, "", "", "", "", "", "", "", "", "", "", "", "", 31242.1, 0, 0, 0],
  [],
  ["REMERAS TERMICAS"],
  ["MODELOS", "CODIGO", "", "", "", "", "", "S", "M", "L", "", "", "", "", "", "", "", "TOTAL"],
  ["NEGRA", 6101, "", "", "", "", "", "", 4, "", "", "", "", "", "", "", "", 0],
  ["ESTAMPADO", 6101, "", "", "", "", "", "", "", 2, "", "", "", "", "", "", "", 0],
  [],
  ["ARTICULO SIN ENCABEZADO DE TALLES"],
  ["MODELOS", "CODIGO", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "TOTAL"],
  ["ITEM RARO", 9999, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", 0],
  [],
  ["PREPARÓ:"],
  ["CONTROLÓ:"],
];

describe("parseSupplierOrderSheet", () => {
  it("solo emite líneas para talles con cantidad pedida (> 0)", () => {
    const { lines } = parseSupplierOrderSheet(FIXTURE);
    // ARGENTINA AZUL (código 1001) no tiene ninguna cantidad cargada → sin líneas
    expect(lines.find((l) => l.codigo === "1001")).toBeUndefined();
    // ARGENTINA CELESTE (1002) tiene 1 en XS,S,M,L,XL,2XL → 6 líneas
    const l1002 = lines.filter((l) => l.codigo === "1002");
    expect(l1002).toHaveLength(6);
    expect(l1002.map((l) => l.talla).sort()).toEqual(["2XL", "L", "M", "S", "XL", "XS"]);
  });

  it("asigna la categoría de la sección más reciente", () => {
    const { lines } = parseSupplierOrderSheet(FIXTURE);
    const l1002 = lines.find((l) => l.codigo === "1002");
    expect(l1002?.categoria).toBe("CAMISETAS");
    const l5300 = lines.find((l) => l.codigo === "5300");
    expect(l5300?.categoria).toBe("BOXERS");
  });

  it("respeta el set de talles propio de cada sección (encabezado distinto)", () => {
    const { lines } = parseSupplierOrderSheet(FIXTURE);
    const l5300 = lines.filter((l) => l.codigo === "5300");
    expect(l5300).toHaveLength(1);
    expect(l5300[0].talla).toBe("M");
  });

  it("productos sin talle (columna CANT) usan talla vacía", () => {
    const { lines } = parseSupplierOrderSheet(FIXTURE);
    const l7000 = lines.filter((l) => l.codigo === "7000");
    expect(l7000).toHaveLength(1);
    expect(l7000[0]).toMatchObject({ talla: "", cantidad: 3, categoria: "PELOTAS N° 5" });
  });

  it("detecta códigos duplicados dentro del mismo archivo", () => {
    const { duplicateCodigos } = parseSupplierOrderSheet(FIXTURE);
    expect(duplicateCodigos).toEqual(["6101"]);
  });

  it("filas de una sección sin talles reconocidos van a inválidas", () => {
    const { invalid } = parseSupplierOrderSheet(FIXTURE);
    expect(invalid).toEqual([
      { fila: expect.any(Number), codigo: "9999", nombre: "ITEM RARO", motivo: "sin encabezado de talles detectado para esta sección" },
    ]);
  });

  it("normaliza códigos numéricos (sin .0 espurio)", () => {
    const { lines } = parseSupplierOrderSheet(FIXTURE);
    expect(lines.every((l) => !l.codigo.includes("."))).toBe(true);
  });

  it("filas de título y firma no generan líneas ni categorías espurias", () => {
    const { lines } = parseSupplierOrderSheet(FIXTURE);
    expect(lines.every((l) => l.categoria !== "CUADRO PEDIDO JUNIO" && l.categoria !== "PREPARÓ:")).toBe(true);
  });
});

describe("buildOrderPlan", () => {
  const { lines, duplicateCodigos } = parseSupplierOrderSheet(FIXTURE);

  it("marca como 'matched' cuando el producto y el talle ya existen", () => {
    const existing = new Map<string, ExistingSupplierProduct>([
      ["1002", { id: "prod-1", sku: "TQ-CAM-argentina-celeste-y-blanco-950", variantsByTalla: new Map([["XS", { id: "var-1", sku: "TQ-CAM-argentina-celeste-y-blanco-950-XS" }]]) }],
    ]);
    const plan = buildOrderPlan(lines, duplicateCodigos, existing);
    const item = plan.find((i) => i.codigo === "1002" && i.talla === "XS")!;
    expect(item.kind).toBe("matched");
    expect(item.variantId).toBe("var-1");
  });

  it("marca 'variante-nueva' cuando el producto existe pero falta el talle", () => {
    const existing = new Map<string, ExistingSupplierProduct>([
      ["1002", { id: "prod-1", sku: "TQ-CAM-argentina-celeste-y-blanco-950", variantsByTalla: new Map() }],
    ]);
    const plan = buildOrderPlan(lines, duplicateCodigos, existing);
    const item = plan.find((i) => i.codigo === "1002" && i.talla === "M")!;
    expect(item.kind).toBe("variante-nueva");
    expect(item.productId).toBe("prod-1");
    expect(item.proposedSku).toBe("TQ-CAM-argentina-celeste-y-blanco-950-M");
  });

  it("marca 'producto-nuevo' cuando el código no existe en la base", () => {
    const plan = buildOrderPlan(lines, duplicateCodigos, new Map());
    const item = plan.find((i) => i.codigo === "1002" && i.talla === "M")!;
    expect(item.kind).toBe("producto-nuevo");
    expect(item.proposedSku).toBeTruthy();
  });

  it("marca 'codigo-duplicado' y no autoresuelve, aunque el producto ya exista", () => {
    const existing = new Map<string, ExistingSupplierProduct>([
      ["6101", { id: "prod-x", sku: "TQ-REM-negra", variantsByTalla: new Map([["M", { id: "var-x", sku: "TQ-REM-negra-M" }]]) }],
    ]);
    const plan = buildOrderPlan(lines, duplicateCodigos, existing);
    const dup = plan.filter((i) => i.codigo === "6101");
    expect(dup).toHaveLength(2); // fila NEGRA (talle M) + fila ESTAMPADO (talle M)
    expect(dup.every((i) => i.kind === "codigo-duplicado")).toBe(true);
    expect(dup.every((i) => i.productId === undefined && i.variantId === undefined)).toBe(true);
  });
});
