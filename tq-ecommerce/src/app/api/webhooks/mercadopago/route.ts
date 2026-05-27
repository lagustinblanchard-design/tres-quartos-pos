import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mpPayment } from "@/lib/mercadopago";
import crypto from "crypto";
import { sendPaymentApprovedEmail } from "@/lib/email";
import { processLoyaltyPurchase } from "@/lib/loyalty";

// Verifica la firma del webhook para confirmar que viene de MercadoPago
function verifySignature(req: NextRequest): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // En dev sin secret, dejar pasar

  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";
  const { searchParams } = req.nextUrl;
  const dataId = searchParams.get("data.id") ?? searchParams.get("id") ?? "";

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(",").find((p) => p.startsWith("ts="))?.split("=")[1] ?? ""}`;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const v1 = xSignature.split(",").find((p) => p.startsWith("v1="))?.split("=")[1] ?? "";
  return v1 === hash;
}

// Mapeo estado MP → estado de la orden en nuestro sistema
function mapMPStatus(mpStatus: string): {
  paymentStatus: "PAGADO" | "PENDIENTE" | "FALLIDO";
  orderStatus: "CONFIRMADO" | "PENDIENTE" | "CANCELADO";
} {
  switch (mpStatus) {
    case "approved":
      return { paymentStatus: "PAGADO", orderStatus: "CONFIRMADO" };
    case "in_process":
    case "pending":
    case "authorized":
      return { paymentStatus: "PENDIENTE", orderStatus: "PENDIENTE" };
    default:
      // rejected, cancelled, refunded, charged_back
      return { paymentStatus: "FALLIDO", orderStatus: "CANCELADO" };
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(req)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = body.type ?? body.topic;

  // Solo procesamos notificaciones de pago
  if (topic !== "payment") {
    return NextResponse.json({ ok: true });
  }

  const paymentId =
    (body.data as Record<string, unknown>)?.id ??
    body.id;

  if (!paymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  // Obtener los detalles del pago desde MP
  const payment = await mpPayment.get({ id: String(paymentId) });
  const orderId = payment.external_reference;

  if (!orderId) {
    return NextResponse.json({ error: "No external_reference" }, { status: 400 });
  }

  const { paymentStatus, orderStatus } = mapMPStatus(payment.status ?? "");

  // Actualizar la orden en la DB
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus,
      status: orderStatus,
      mpPaymentId: String(paymentId),
    },
  });

  // Si el pago fue aprobado, procesar fidelidad y enviar email
  if (paymentStatus === "PAGADO") {
    processLoyaltyPurchase(orderId).catch(() => {});
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, email: true } },
        items: {
          include: { variant: { include: { product: { select: { name: true } } } } },
        },
      },
    });

    if (fullOrder) {
      const email = fullOrder.user?.email ?? fullOrder.guestEmail;
      const name = fullOrder.user?.name ?? fullOrder.shippingName ?? fullOrder.guestName ?? "Cliente";
      if (email) {
        sendPaymentApprovedEmail({
          orderNumber: fullOrder.number,
          orderId: fullOrder.id,
          customerName: name,
          customerEmail: email,
          items: fullOrder.items.map((item) => ({
            name: item.variant.product.name,
            variant: [item.variant.color, item.variant.size].filter(Boolean).join(" "),
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
          })),
          subtotal: Number(fullOrder.subtotal),
          shipping: Number(fullOrder.shipping),
          total: Number(fullOrder.total),
          paymentMethod: "MERCADOPAGO",
          shippingAddr: fullOrder.shippingAddr ?? undefined,
          shippingCity: fullOrder.shippingCity ?? undefined,
        });
      }
    }
  }

  // Si el pago fue rechazado, devolver el stock
  if (paymentStatus === "FALLIDO") {
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      include: { variant: true },
    });

    await prisma.$transaction(
      orderItems.map((item) =>
        prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        })
      )
    );

    // Registrar la devolución de stock
    await prisma.stockMovement.createMany({
      data: orderItems.map((item) => ({
        variantId: item.variantId,
        type: "DEVOLUCION" as const,
        quantity: item.quantity,
        previousQty: item.variant.stock,
        newQty: item.variant.stock + item.quantity,
        reason: "Pago rechazado / cancelado por MercadoPago",
        reference: `Pago MP #${paymentId}`,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
