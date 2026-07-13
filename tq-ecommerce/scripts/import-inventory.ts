/**
 * Importa el inventario desde el Excel plano (salida de convertir_excel.py)
 * a la base canónica. Ver design.md §D6 y specs/inventory-import/spec.md.
 *
 * Uso:
 *   npm run import:inventory -- ruta/stock_convertido.xlsx           (dry-run)
 *   npm run import:inventory -- ruta/stock_convertido.xlsx --apply   (aplica)
 *
 * El dry-run nunca escribe en la base; solo genera import-report.md junto
 * al archivo de entrada. Revisar ese reporte (y el conteo físico de las
 * variantes marcadas con diferencia de stock) ANTES de correr con --apply.
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import { applyStockAdjustment } from "../src/lib/inventory";
import {
  parseRows,
  buildImportPlan,
  renderReport,
  productSlug,
  categoryCode,
  slugify,
  type ImportPlanItem,
} from "./import-inventory-lib";

async function loadExistingCatalog() {
  const variants = await prisma.productVariant.findMany({
    select: { sku: true, stock: true, price: true },
  });
  const existingVariantsBySku = new Map(
    variants.map((v) => [v.sku, { stock: v.stock, price: Number(v.price) }])
  );

  const products = await prisma.product.findMany({ select: { sku: true } });
  const existingProductSkus = new Set(products.map((p) => p.sku));

  return { existingVariantsBySku, existingProductSkus };
}

async function resolveCategory(categoria: string) {
  const existing = await prisma.category.findFirst({ where: { name: categoria } });
  if (existing) return existing;

  const baseSlug = slugify(categoria) || categoryCode(categoria).toLowerCase();
  let slug = baseSlug;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.category.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return prisma.category.create({ data: { name: categoria, slug } });
}

/** Código de proveedor a usar para el grupo, o undefined si hay conflicto
 * dentro del propio archivo (ya detectado por buildImportPlan) o si el
 * código ya pertenece a otro producto en la base. Nunca se sobreescribe
 * silenciosamente — se avisa por consola y se omite el mapeo. */
async function resolveGroupCodigo(items: ImportPlanItem[], productSku: string): Promise<string | undefined> {
  if (items.some((i) => i.codigoConflicto)) {
    console.warn(`  "${items[0].nombre}": el archivo trae más de un código de proveedor para este producto — no se mapea.`);
    return undefined;
  }

  const codigo = items.find((i) => i.codigo)?.codigo;
  if (!codigo) return undefined;

  const conflict = await prisma.product.findUnique({ where: { supplierCode: codigo } });
  if (conflict && conflict.sku !== productSku) {
    console.warn(`  Código de proveedor "${codigo}" (${items[0].nombre}) ya pertenece a otro producto — se omite el mapeo.`);
    return undefined;
  }

  return codigo;
}

async function applyPlan(plan: ReturnType<typeof buildImportPlan>, fecha: string) {
  const reason = `Importación inicial Excel ${fecha}`;

  // Agrupar por producto para crear categoría/producto una sola vez.
  const byProduct = new Map<string, typeof plan.items>();
  for (const item of plan.items) {
    const list = byProduct.get(item.productSku) ?? [];
    list.push(item);
    byProduct.set(item.productSku, list);
  }

  for (const [productSku, items] of byProduct) {
    const { categoria, nombre } = items[0];

    const category = await resolveCategory(categoria);
    const codigoGrupo = await resolveGroupCodigo(items, productSku);

    let product = await prisma.product.findUnique({ where: { sku: productSku } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          sku: productSku,
          name: nombre,
          slug: productSlug(categoria, nombre),
          categoryId: category.id,
          supplierCode: codigoGrupo,
        },
      });
    } else if (codigoGrupo && !product.supplierCode) {
      // Nunca se pisa un código ya mapeado (manual o de una importación previa).
      product = await prisma.product.update({
        where: { id: product.id },
        data: { supplierCode: codigoGrupo },
      });
    }

    for (const item of items) {
      const existingVariant = await prisma.productVariant.findUnique({ where: { sku: item.sku } });

      if (!existingVariant) {
        const created = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: item.sku,
            size: item.talla,
            price: item.precioVenta,
            costPrice: item.precioCosto || null,
            stock: 0,
          },
        });
        await prisma.$transaction((tx) =>
          applyStockAdjustment(tx, created.id, "AJUSTE", item.stockExcel, { reason })
        );
        continue;
      }

      // Variante existente: solo tocar stock si difiere del Excel (idempotencia).
      if (existingVariant.stock !== item.stockExcel) {
        await prisma.$transaction((tx) =>
          applyStockAdjustment(tx, existingVariant.id, "AJUSTE", item.stockExcel, { reason })
        );
      }
      if (Number(existingVariant.price) !== item.precioVenta) {
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: { price: item.precioVenta },
        });
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Uso: import-inventory.ts <archivo.xlsx> [--apply]");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  const workbook = XLSX.readFile(resolved);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const { valid, invalid } = parseRows(raw);
  const { existingVariantsBySku, existingProductSkus } = await loadExistingCatalog();
  const plan = buildImportPlan(valid, existingVariantsBySku, existingProductSkus);

  const report = renderReport(plan, invalid, path.basename(resolved));
  const reportPath = path.join(path.dirname(resolved), "import-report.md");
  fs.writeFileSync(reportPath, report, "utf8");

  console.log(`Filas válidas: ${valid.length} | inválidas: ${invalid.length}`);
  console.log(
    `Productos nuevos: ${plan.resumen.productosNuevos} | Variantes nuevas: ${plan.resumen.variantesNuevas} | Con diferencia de stock: ${plan.resumen.variantesConDiferencia}`
  );
  if (plan.resumen.codigosConflicto > 0) {
    console.warn(`Códigos de proveedor en conflicto dentro del archivo (no se mapean): ${plan.resumen.codigosConflicto}`);
  }
  console.log(`Reporte escrito en: ${reportPath}`);

  if (!apply) {
    console.log("\nDry-run: no se escribió nada en la base. Revisar el reporte y correr con --apply cuando esté confirmado.");
    return;
  }

  if (plan.resumen.variantesConDiferencia > 0) {
    console.warn(
      `\nATENCIÓN: hay ${plan.resumen.variantesConDiferencia} variantes con diferencia de stock. Verificar que ya se hizo el conteo físico antes de continuar.`
    );
  }

  const fecha = new Date().toISOString().slice(0, 10);
  await applyPlan(plan, fecha);
  console.log("\nImportación aplicada.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
