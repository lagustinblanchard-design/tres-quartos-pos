import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIntegrationApiKey } from "@/lib/integration-auth";
import { decrementStockForSale, InsufficientStockError } from "@/lib/inventory";
import { z } from "zod";

const schema = z.object({
  reference: z.string().min(1),
  items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1),
});

/**
 * POST /api/integration/sale
 * Registra el descuento de stock de una venta del POS Flask. No crea una
 * Order en el ecommerce (la venta vive en la base del POS) — solo mueve
 * el stock canónico y deja el ledger con la referencia externa.
 *
 * Idempotente por `reference`: si ya existe un StockMovement VENTA con esa
 * referencia, no se vuelve a aplicar (protege reintentos del POS tras un
 * timeout de red).
 */
export async function POST(req: NextRequest) {
  const authError = requireIntegrationApiKey(req);
  if (authError) return authError;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { reference, items } = parsed.data;

  const skus = items.map((i) => i.sku);
  const variants = await prisma.productVariant.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const idToSku = new Map(variants.map((v) => [v.id, v.sku]));
  const skuToId = new Map(variants.map((v) => [v.sku, v.id]));

  const notFound = skus.filter((sku) => !skuToId.has(sku));
  if (notFound.length) {
    return NextResponse.json({ error: "SKU no encontrado", skus: notFound }, { status: 400 });
  }

  let duplicate = false;
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockMovement.findFirst({
        where: { type: "VENTA", reference },
        select: { id: true },
      });
      if (existing) {
        duplicate = true;
        return;
      }

      await decrementStockForSale(
        tx,
        items.map((i) => ({ variantId: skuToId.get(i.sku)!, quantity: i.quantity })),
        { reason: "Venta POS Flask", reference }
      );
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error: "Stock insuficiente",
          details: err.failures.map((f) => ({
            sku: idToSku.get(f.variantId) ?? f.variantId,
            requested: f.requested,
            available: f.available,
          })),
        },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, reference, duplicate });
}
