import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

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

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  let newStock: number;
  if (type === "ENTRADA") {
    newStock = variant.stock + quantity;
  } else if (type === "SALIDA") {
    newStock = Math.max(0, variant.stock - quantity);
  } else {
    // AJUSTE: quantity es el nuevo valor absoluto
    newStock = quantity;
  }

  const [updatedVariant, movement] = await prisma.$transaction([
    prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: newStock },
    }),
    prisma.stockMovement.create({
      data: {
        variantId,
        type,
        quantity: type === "AJUSTE" ? newStock - variant.stock : quantity,
        previousQty: variant.stock,
        newQty: newStock,
        reason,
        reference,
        userId: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({
    variant: { ...updatedVariant, price: Number(updatedVariant.price) },
    movement,
  });
}
