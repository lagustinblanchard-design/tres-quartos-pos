import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processLoyaltyPurchase } from "@/lib/loyalty";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId requerido" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!order.userId) return NextResponse.json({ error: "Pedido sin cliente registrado" }, { status: 400 });

  const already = await prisma.loyaltyTransaction.findUnique({ where: { orderId } });
  if (already) return NextResponse.json({ error: "Este pedido ya fue acreditado" }, { status: 409 });

  await processLoyaltyPurchase(orderId);

  const account = await prisma.loyaltyAccount.findUnique({ where: { userId: order.userId } });
  return NextResponse.json({ ok: true, qualifyingCount: account?.qualifyingCount ?? 0 });
}
