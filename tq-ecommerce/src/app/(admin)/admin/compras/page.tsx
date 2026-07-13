import { prisma } from "@/lib/prisma";
import { CompraUploader } from "@/components/admin/compra-uploader";

export const metadata = { title: "Compras | Admin" };
export const dynamic = "force-dynamic";

async function getOrders() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      supplier: { select: { name: true } },
      items: { select: { id: true, quantity: true } },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    supplier: o.supplier.name,
    status: o.status,
    total: o.total ? Number(o.total) : null,
    itemCount: o.items.length,
    totalUnidades: o.items.reduce((a, i) => a + i.quantity, 0),
    createdAt: o.createdAt.toISOString(),
  }));
}

export default async function ComprasPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compras a proveedores</h1>
        <p className="text-gray-500 text-sm">
          Subí el mismo Cuadro de Pedido que le mandás al proveedor. El stock se suma recién al confirmar la recepción.
        </p>
      </div>
      <CompraUploader initialOrders={orders} />
    </div>
  );
}
