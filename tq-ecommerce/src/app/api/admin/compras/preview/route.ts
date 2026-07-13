import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSupplierOrderSheet, buildOrderPlan, type ExistingSupplierProduct } from "../../../../../../scripts/supplier-order-lib";

/**
 * POST /api/admin/compras/preview
 * Recibe el "Cuadro de Pedido" del proveedor (multipart/form-data, campo
 * "file") y devuelve el plan de compra (dry-run, no escribe nada).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo. ¿Es un Excel válido?" }, { status: 400 });
  }

  // La hoja de instrucciones ("Instructivo") no tiene datos; se toma la
  // primera hoja que no matchee ese nombre (o la primera del libro si no
  // se encuentra ninguna).
  const sheetName =
    workbook.SheetNames.find((n) => !/instructivo/i.test(n)) ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return NextResponse.json({ error: "El archivo no tiene hojas legibles" }, { status: 400 });
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  const { lines, invalid, duplicateCodigos } = parseSupplierOrderSheet(matrix);

  const codigos = [...new Set(lines.map((l) => l.codigo))];
  const productos = await prisma.product.findMany({
    where: { supplierCode: { in: codigos } },
    select: {
      id: true,
      sku: true,
      supplierCode: true,
      variants: { select: { id: true, sku: true, size: true, price: true } },
    },
  });

  const existingBySupplierCode = new Map<string, ExistingSupplierProduct>(
    productos
      .filter((p) => p.supplierCode)
      .map((p) => [
        p.supplierCode as string,
        {
          id: p.id,
          sku: p.sku,
          variantsByTalla: new Map(
            p.variants.map((v) => [(v.size || "").toUpperCase() || "UNICA", { id: v.id, sku: v.sku }])
          ),
        },
      ])
  );

  const plan = buildOrderPlan(lines, duplicateCodigos, existingBySupplierCode);

  const resumen = {
    totalLineas: plan.length,
    matched: plan.filter((i) => i.kind === "matched").length,
    varianteNueva: plan.filter((i) => i.kind === "variante-nueva").length,
    productoNuevo: plan.filter((i) => i.kind === "producto-nuevo").length,
    codigoDuplicado: plan.filter((i) => i.kind === "codigo-duplicado").length,
    filasInvalidas: invalid.length,
  };

  return NextResponse.json({ items: plan, invalid, resumen, sheetName });
}
