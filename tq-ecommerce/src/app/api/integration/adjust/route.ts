import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIntegrationApiKey } from "@/lib/integration-auth";
import { applyStockAdjustment, VariantNotFoundError } from "@/lib/inventory";
import { z } from "zod";

const schema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().min(0), // valor absoluto de stock (semántica AJUSTE)
  reason: z.string().min(1),
  reference: z.string().optional(),
});

/**
 * POST /api/integration/adjust
 * Ajuste absoluto de stock (conteo físico) desde el POS Flask.
 */
export async function POST(req: NextRequest) {
  const authError = requireIntegrationApiKey(req);
  if (authError) return authError;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { sku, quantity, reason, reference } = parsed.data;

  const variant = await prisma.productVariant.findUnique({ where: { sku }, select: { id: true } });
  if (!variant) {
    return NextResponse.json({ error: "SKU no encontrado" }, { status: 404 });
  }

  const result = await prisma.$transaction((tx) =>
    applyStockAdjustment(tx, variant.id, "AJUSTE", quantity, { reason, reference })
  ).catch((err) => {
    if (err instanceof VariantNotFoundError) return null;
    throw err;
  });

  if (!result) {
    return NextResponse.json({ error: "SKU no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    sku,
    stock: result.variant.stock,
    movimiento: { previousQty: result.movement.previousQty, newQty: result.movement.newQty },
  });
}
