import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

const schema = z.object({
  sessionId: z.string(),
  items: z.array(itemSchema).min(1),
  paymentMethod: z.enum([
    "EFECTIVO",
    "TARJETA_DEBITO",
    "TARJETA_CREDITO",
    "TRANSFERENCIA",
    "MERCADOPAGO_QR",
  ]),
  discount: z.number().min(0).max(100).default(0),
  cashGiven: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { sessionId, items, paymentMethod, discount } = parsed.data;

  // Verify session belongs to user and is open
  const posSession = await prisma.posSession.findFirst({
    where: { id: sessionId, userId: session.user.id, closedAt: null },
  });
  if (!posSession) {
    return NextResponse.json({ error: "Sesión de caja no válida" }, { status: 400 });
  }

  // Fetch variants to validate stock and prices
  const variantIds = items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    select: { id: true, stock: true, price: true },
  });

  const variantMap = Object.fromEntries(variants.map((v) => [v.id, v]));

  // Check stock
  const stockErrors: string[] = [];
  for (const item of items) {
    const v = variantMap[item.variantId];
    if (!v) { stockErrors.push(`Variante ${item.variantId} no encontrada`); continue; }
    if (v.stock < item.quantity) stockErrors.push(`Stock insuficiente para ${item.variantId}`);
  }
  if (stockErrors.length) {
    return NextResponse.json({ error: stockErrors }, { status: 409 });
  }

  // Calculate totals
  const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;

  // Transaction: create order + decrement stock + update session totals
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        channel: "POS",
        status: "ENTREGADO",
        paymentStatus: "PAGADO",
        paymentMethod,
        posSessionId: sessionId,
        subtotal,
        discount: discountAmount,
        shipping: 0,
        total,
        items: {
          create: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: 0,
            subtotal: i.unitPrice * i.quantity,
          })),
        },
      },
      select: { id: true, number: true, total: true, createdAt: true },
    });

    // Decrement stock + create movements
    for (const item of items) {
      const v = variantMap[item.variantId];
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          type: "VENTA",
          quantity: item.quantity,
          previousQty: v.stock,
          newQty: v.stock - item.quantity,
          reason: "Venta POS",
          reference: `POS #${newOrder.number}`,
        },
      });
    }

    // Update session totals
    const totalField = {
      EFECTIVO: "totalCash",
      TARJETA_DEBITO: "totalCard",
      TARJETA_CREDITO: "totalCard",
      TRANSFERENCIA: "totalTransfer",
      MERCADOPAGO_QR: "totalMp",
    }[paymentMethod] ?? "totalCash";

    await tx.posSession.update({
      where: { id: sessionId },
      data: {
        totalSales: { increment: total },
        [totalField]: { increment: total },
      },
    });

    return newOrder;
  });

  return NextResponse.json({
    orderId: order.id,
    number: order.number,
    total: Number(order.total),
    createdAt: order.createdAt.toISOString(),
  });
}
