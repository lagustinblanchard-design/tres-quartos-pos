import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mpPreference } from "@/lib/mercadopago";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { sendOrderConfirmation } from "@/lib/email";

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  shipping: z.object({
    name: z.string().min(2),
    phone: z.string().min(6),
    email: z.string().email(),
    address: z.string().min(5),
    city: z.string().min(2),
    province: z.string().min(2),
    postalCode: z.string().min(4),
  }),
  // TRANSFERENCIA no pasa por MP; efectivo es solo para POS
  paymentMethod: z.enum([
    "MERCADOPAGO",
    "TRANSFERENCIA",
  ]),
  guestName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, shipping, paymentMethod, guestName } = parsed.data;

  // ── 1. Verificar stock de cada variante ────────────────────────────────────
  const variantIds = items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: { product: { select: { name: true } } },
  });

  const stockErrors: string[] = [];
  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) {
      stockErrors.push(`Variante ${item.variantId} no encontrada`);
    } else if (variant.stock < item.quantity) {
      stockErrors.push(
        `${variant.product.name} (${[variant.color, variant.size].filter(Boolean).join("/")}) — solo quedan ${variant.stock} unidades`
      );
    }
  }
  if (stockErrors.length > 0) {
    return NextResponse.json({ error: "Stock insuficiente", details: stockErrors }, { status: 409 });
  }

  // ── 2. Calcular totales ────────────────────────────────────────────────────
  const orderItems = items.map((item) => {
    const variant = variants.find((v) => v.id === item.variantId)!;
    const unitPrice = Number(variant.price);
    return {
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice,
      discount: 0,
      subtotal: unitPrice * item.quantity,
    };
  });

  const subtotal = orderItems.reduce((acc, i) => acc + i.subtotal, 0);
  const shippingCost = subtotal >= 50000 ? 0 : 2500; // Lógica simple, mejorar con ShippingZone
  const total = subtotal + shippingCost;

  // ── 3. Crear la Order en DB (estado PENDIENTE) ─────────────────────────────
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        channel: "ONLINE",
        status: "PENDIENTE",
        userId: session?.user.id ?? null,
        guestEmail: session ? null : shipping.email,
        guestName: session ? null : (guestName ?? shipping.name),
        subtotal,
        discount: 0,
        shipping: shippingCost,
        total,
        paymentMethod: paymentMethod as "MERCADOPAGO" | "TRANSFERENCIA",
        paymentStatus: "PENDIENTE",
        shippingName: shipping.name,
        shippingPhone: shipping.phone,
        shippingAddr: shipping.address,
        shippingCity: shipping.city,
        shippingProv: shipping.province,
        shippingCp: shipping.postalCode,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    // Reservar stock (descontar mientras la orden está pendiente de pago)
    for (const item of orderItems) {
      const variant = variants.find((v) => v.id === item.variantId)!;
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          type: "VENTA",
          quantity: item.quantity,
          previousQty: variant.stock,
          newQty: variant.stock - item.quantity,
          reason: "Venta online",
          reference: `Pedido #${newOrder.number}`,
        },
      });
    }

    return newOrder;
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── 4. Crear preferencia de MercadoPago (solo si el método es MP) ──────────
  if (paymentMethod === "MERCADOPAGO") {
    const preference = await mpPreference.create({
      body: {
        external_reference: order.id,
        payer: {
          name: shipping.name,
          email: shipping.email,
          phone: { number: shipping.phone },
          address: {
            street_name: shipping.address,
            zip_code: shipping.postalCode,
          },
        },
        items: orderItems.map((item) => {
          const variant = variants.find((v) => v.id === item.variantId)!;
          return {
            id: item.variantId,
            title: `${variant.product.name} ${[variant.color, variant.size].filter(Boolean).join(" ")}`,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            currency_id: "ARS",
          };
        }),
        shipments: {
          cost: shippingCost,
          mode: "not_specified",
        },
        back_urls: {
          success: `${appUrl}/checkout/confirmacion/${order.id}?status=success`,
          failure: `${appUrl}/checkout/confirmacion/${order.id}?status=failure`,
          pending: `${appUrl}/checkout/confirmacion/${order.id}?status=pending`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        statement_descriptor: "TQ DEPORTES",
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      },
    });

    // Guardar el preference ID en la orden
    await prisma.order.update({
      where: { id: order.id },
      data: { mpPaymentId: preference.id },
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.number,
      preferenceId: preference.id,
      initPoint: preference.init_point,      // URL de producción
      sandboxInitPoint: preference.sandbox_init_point, // URL de sandbox
    });
  }

  // Transferencia: confirmar orden y enviar email
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "CONFIRMADO" },
  });

  // Email de confirmación para transferencia (fire-and-forget)
  sendOrderConfirmation({
    orderNumber: order.number,
    orderId: order.id,
    customerName: shipping.name,
    customerEmail: shipping.email,
    items: orderItems.map((item) => {
      const v = variants.find((va) => va.id === item.variantId)!;
      return {
        name: v.product.name,
        variant: [v.color, v.size].filter(Boolean).join(" "),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      };
    }),
    subtotal,
    shipping: shippingCost,
    total,
    paymentMethod: "TRANSFERENCIA",
    shippingAddr: shipping.address,
    shippingCity: shipping.city,
  });

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.number,
    transferInfo: {
      alias: "TQ.DEPORTES.MP",
      cbu: "0000000000000000000000",
      amount: total,
      reference: `Pedido #${order.number}`,
    },
  });
}
