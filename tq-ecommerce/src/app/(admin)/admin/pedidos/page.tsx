import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/orders-table";

export const metadata = { title: "Pedidos — Admin" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  "TODOS",
  "PENDIENTE",
  "CONFIRMADO",
  "EN_PREPARACION",
  "DESPACHADO",
  "ENTREGADO",
  "CANCELADO",
] as const;

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; channel?: string };
}) {
  const status = STATUS_OPTIONS.includes(searchParams.status as (typeof STATUS_OPTIONS)[number])
    ? searchParams.status
    : undefined;

  const orders = await prisma.order.findMany({
    where: {
      ...(status && status !== "TODOS" ? { status: status as never } : {}),
      ...(searchParams.channel && searchParams.channel !== "TODOS"
        ? { channel: searchParams.channel as never }
        : {}),
      ...(searchParams.q
        ? {
            OR: [
              { shippingName: { contains: searchParams.q, mode: "insensitive" } },
              { guestEmail: { contains: searchParams.q, mode: "insensitive" } },
              { user: { email: { contains: searchParams.q, mode: "insensitive" } } },
              { user: { name: { contains: searchParams.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      items: { select: { id: true } },
    },
  });

  const counts = await prisma.order.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));

  const serialized = orders.map((o) => ({
    id: o.id,
    number: o.number,
    channel: o.channel,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    total: Number(o.total),
    itemCount: o.items.length,
    shippingName: o.shippingName,
    customerName: o.user?.name ?? o.shippingName ?? o.guestName ?? "—",
    customerEmail: o.user?.email ?? o.guestEmail ?? "—",
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de pedidos online y POS</p>
      </div>
      <OrdersTable orders={serialized} countMap={countMap} />
    </div>
  );
}
