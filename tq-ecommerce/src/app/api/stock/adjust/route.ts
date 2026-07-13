import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { applyStockAdjustment, VariantNotFoundError } from "@/lib/inventory";

const adjustSchema = z.object({
  variantId: z.string().min(1),
  type: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
  reference: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { variantId, type, quantity, reason, reference } = parsed.data;

  let result;
  try {
    result = await prisma.$transaction((tx) =>
      applyStockAdjustment(tx, variantId, type, quantity, {
        reason,
        reference,
        userId: session.user.id,
      })
    );
  } catch (err) {
    if (err instanceof VariantNotFoundError) {
      return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({
    variant: { ...result.variant, price: Number(result.variant.price) },
    movement: result.movement,
  });
}
