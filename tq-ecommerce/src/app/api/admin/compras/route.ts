import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { buildProductSku, productSlug, slugify, categoryCode } from "../../../../../scripts/import-inventory-lib";

const itemSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  categoria: z.string().min(1),
  talla: z.string(),
  cantidad: z.number().int().positive(),
  kind: z.enum(["matched", "variante-nueva", "producto-nuevo", "codigo-duplicado"]),
  productId: z.string().optional(),
  variantId: z.string().optional(),
  proposedSku: z.string().optional(),
  costoUnitario: z.number().min(0).optional(),
  precioVenta: z.number().min(0).optional(),
});

const bodySchema = z.object({
  supplierName: z.string().min(1),
  items: z.array(itemSchema).min(1),
});

// GET: listar órdenes de compra
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      supplier: { select: { name: true } },
      items: { select: { id: true, quantity: true } },
    },
  });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      supplier: o.supplier.name,
      status: o.status,
      total: o.total ? Number(o.total) : null,
      itemCount: o.items.length,
      totalUnidades: o.items.reduce((a, i) => a + i.quantity, 0),
      createdAt: o.createdAt.toISOString(),
    }))
  );
}

async function resolveCategory(categoria: string) {
  const existing = await prisma.category.findFirst({ where: { name: categoria } });
  if (existing) return existing;

  const baseSlug = slugify(categoria) || categoryCode(categoria).toLowerCase();
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.category.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return prisma.category.create({ data: { name: categoria, slug } });
}

// POST: crear la orden de compra a partir del plan confirmado (preview)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { supplierName, items } = parsed.data;

  const duplicados = items.filter((i) => i.kind === "codigo-duplicado");
  if (duplicados.length > 0) {
    return NextResponse.json(
      {
        error: "Hay códigos duplicados en el archivo sin resolver. Elegí a qué producto corresponde cada uno antes de confirmar.",
        codigos: [...new Set(duplicados.map((i) => i.codigo))],
      },
      { status: 400 }
    );
  }

  for (const item of items) {
    if ((item.kind === "variante-nueva" || item.kind === "producto-nuevo") && !item.proposedSku) {
      return NextResponse.json({ error: `Falta el SKU propuesto para ${item.codigo} / ${item.talla}` }, { status: 400 });
    }
    if (item.kind === "variante-nueva" && !item.productId) {
      return NextResponse.json({ error: `Falta productId para variante nueva de ${item.codigo}` }, { status: 400 });
    }
    if (item.kind === "matched" && !item.variantId) {
      return NextResponse.json({ error: `Falta variantId para ítem matched ${item.codigo}` }, { status: 400 });
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const supplier =
        (await tx.supplier.findFirst({ where: { name: supplierName } })) ??
        (await tx.supplier.create({ data: { name: supplierName } }));

      // Memoiza productos nuevos creados en esta misma request: varias
      // líneas (una por talle) pueden compartir el mismo código nuevo.
      const productosCreados = new Map<string, { id: string; sku: string }>();
      const variantSkuPorItem: string[] = [];
      let costoConocidoParaTodos = true;
      let totalAcumulado = 0;

      for (const item of items) {
        let variantSku: string;

        if (item.kind === "matched") {
          const variant = await tx.productVariant.findUnique({ where: { id: item.variantId! }, select: { sku: true } });
          if (!variant) throw new Error(`Variante ${item.variantId} no encontrada`);
          variantSku = variant.sku;
        } else if (item.kind === "variante-nueva") {
          const hermana = await tx.productVariant.findFirst({
            where: { productId: item.productId! },
            select: { price: true },
          });
          const variant = await tx.productVariant.create({
            data: {
              productId: item.productId!,
              sku: item.proposedSku!,
              size: item.talla || null,
              price: item.precioVenta ?? (hermana ? Number(hermana.price) : 0),
              stock: 0,
            },
          });
          variantSku = variant.sku;
        } else {
          // producto-nuevo: crear producto (una vez por código) + variante
          let producto = productosCreados.get(item.codigo);
          if (!producto) {
            const category = await resolveCategory(item.categoria);
            const productSku = buildProductSku(item.categoria, item.nombre);
            const created = await tx.product.create({
              data: {
                name: item.nombre,
                slug: productSlug(item.categoria, item.nombre),
                sku: productSku,
                supplierCode: item.codigo,
                categoryId: category.id,
              },
            });
            producto = { id: created.id, sku: created.sku };
            productosCreados.set(item.codigo, producto);
          }
          const variant = await tx.productVariant.create({
            data: {
              productId: producto.id,
              sku: item.proposedSku!,
              size: item.talla || null,
              price: item.precioVenta ?? 0,
              stock: 0,
            },
          });
          variantSku = variant.sku;
        }

        variantSkuPorItem.push(variantSku);
        if (item.costoUnitario === undefined) costoConocidoParaTodos = false;
        else totalAcumulado += item.costoUnitario * item.cantidad;
      }

      const newOrder = await tx.purchaseOrder.create({
        data: {
          supplierId: supplier.id,
          status: "PENDIENTE",
          total: costoConocidoParaTodos ? totalAcumulado : null,
          items: {
            create: items.map((item, idx) => ({
              variantSku: variantSkuPorItem[idx],
              quantity: item.cantidad,
              unitCost: item.costoUnitario ?? null,
            })),
          },
        },
        select: { id: true },
      });

      return newOrder;
    });

    return NextResponse.json({ ok: true, orderId: order.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error creando la orden" }, { status: 400 });
  }
}
