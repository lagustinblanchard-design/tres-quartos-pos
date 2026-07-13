import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrementStockForSale, InsufficientStockError } from "@/lib/inventory";
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

  // Validate that all variants exist and are active (pricing/catalog check;
  // stock availability is validated atomically inside the transaction)
  const variantIds = items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    select: { id: true },
  });
  const foundIds = new Set(variants.map((v) => v.id));
  const notFound = variantIds.filter((id) => !foundIds.has(id));
  if (notFound.length) {
    return NextResponse.json(
      { error: notFound.map((id) => `Variante ${id} no encontrada`) },
      { status: 400 }
    );
  }

  // Calculate totals
  const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;

  // Transaction: create order + decrement stock (atomic, all-or-nothing) + update session totals
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
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

      await decrementStockForSale(
        tx,
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        { reason: "Venta POS", reference: `POS #${newOrder.number}`, userId: session.user.id }
      );

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
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: "Stock insuficiente", details: err.failures },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({
    orderId: order.id,
    number: order.number,
    total: Number(order.total),
    createdAt: order.createdAt.toISOString(),
  });
}
