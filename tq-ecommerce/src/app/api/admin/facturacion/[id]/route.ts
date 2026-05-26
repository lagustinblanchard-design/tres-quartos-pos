import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          items: {
            include: {
              variant: { include: { product: { select: { name: true } } } },
            },
          },
        },
      },
      user: { select: { name: true, email: true } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...invoice,
    subtotal: Number(invoice.subtotal),
    iva: Number(invoice.iva),
    total: Number(invoice.total),
    createdAt: invoice.createdAt.toISOString(),
    cancelledAt: invoice.cancelledAt?.toISOString() ?? null,
    afipVto: invoice.afipVto?.toISOString() ?? null,
    order: invoice.order
      ? {
          number: invoice.order.number,
          items: invoice.order.items.map((item) => ({
            id: item.id,
            name: item.variant.product.name,
            variant: [item.variant.color, item.variant.size ? `T.${item.variant.size}` : null].filter(Boolean).join(" "),
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
          })),
        }
      : null,
  });
}

// PATCH → anular comprobante
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, select: { cancelledAt: true } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.cancelledAt) return NextResponse.json({ error: "Ya está anulado" }, { status: 409 });

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { cancelledAt: new Date() },
    select: { id: true, cancelledAt: true },
  });

  return NextResponse.json(updated);
}
