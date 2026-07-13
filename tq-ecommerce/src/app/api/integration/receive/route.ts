import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIntegrationApiKey } from "@/lib/integration-auth";
import { receiveStock, VariantNotFoundError } from "@/lib/inventory";
import { z } from "zod";

const schema = z.object({
  reference: z.string().optional(),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unitCost: z.number().min(0).optional(),
      })
    )
    .min(1),
});

/**
 * POST /api/integration/receive
 * Recepción de mercadería desde el POS Flask: incrementa stock, registra
 * StockMovement tipo ENTRADA y actualiza costPrice si se informa costo.
 */
export async function POST(req: NextRequest) {
  const authError = requireIntegrationApiKey(req);
  if (authError) return authError;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { reference, reason, items } = parsed.data;

  const skus = items.map((i) => i.sku);
  const variants = await prisma.productVariant.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const skuToId = new Map(variants.map((v) => [v.sku, v.id]));

  const notFound = skus.filter((sku) => !skuToId.has(sku));
  if (notFound.length) {
    return NextResponse.json({ error: "SKU no encontrado", skus: notFound }, { status: 400 });
  }

  try {
    await prisma.$transaction((tx) =>
      receiveStock(
        tx,
        items.map((i) => ({ variantId: skuToId.get(i.sku)!, quantity: i.quantity, unitCost: i.unitCost })),
        { reason: reason ?? "Recepción de compra (POS)", reference }
      )
    );
  } catch (err) {
    if (err instanceof VariantNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }

  const updated = await prisma.productVariant.findMany({
    where: { sku: { in: skus } },
    select: { sku: true, stock: true, costPrice: true },
  });

  return NextResponse.json({
    ok: true,
    variantes: updated.map((v) => ({
      sku: v.sku,
      stock: v.stock,
      costo: v.costPrice ? Number(v.costPrice) : null,
    })),
  });
}
