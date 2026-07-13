import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { receiveStock, VariantNotFoundError } from "@/lib/inventory";

/**
 * POST /api/admin/compras/[id]/recibir
 * Confirma la recepción de una orden pendiente: incrementa stock por cada
 * ítem (StockMovement tipo ENTRADA, con actualización de costPrice cuando
 * se conoce) y marca la orden como recibida. Idempotente: una orden ya
 * recibida no se puede recibir de nuevo (409).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  if (order.status !== "PENDIENTE") {
    return NextResponse.json({ error: `La orden ya está en estado ${order.status}` }, { status: 409 });
  }

  const variantes = await prisma.productVariant.findMany({
    where: { sku: { in: order.items.map((i) => i.variantSku) } },
    select: { id: true, sku: true },
  });
  const idPorSku = new Map(variantes.map((v) => [v.sku, v.id]));

  const noEncontradas = order.items.filter((i) => !idPorSku.has(i.variantSku));
  if (noEncontradas.length > 0) {
    return NextResponse.json(
      { error: "Hay ítems cuya variante ya no existe", skus: noEncontradas.map((i) => i.variantSku) },
      { status: 409 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await receiveStock(
        tx,
        order.items.map((i) => ({
          variantId: idPorSku.get(i.variantSku)!,
          quantity: i.quantity,
          unitCost: i.unitCost ? Number(i.unitCost) : undefined,
        })),
        { reason: "Recepción de compra", reference: `PO #${order.id}` }
      );

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: "RECIBIDA" },
      });
    });
  } catch (err) {
    if (err instanceof VariantNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
