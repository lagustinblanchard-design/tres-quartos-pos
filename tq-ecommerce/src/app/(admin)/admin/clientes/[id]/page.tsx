import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingBag, MapPin, Phone, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente", CONFIRMADO: "Confirmado", EN_PREPARACION: "En prep.",
  DESPACHADO: "Despachado", ENTREGADO: "Entregado", CANCELADO: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800", CONFIRMADO: "bg-blue-100 text-blue-800",
  EN_PREPARACION: "bg-indigo-100 text-indigo-800", DESPACHADO: "bg-purple-100 text-purple-800",
  ENTREGADO: "bg-green-100 text-green-800", CANCELADO: "bg-gray-100 text-gray-600",
};

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, number: true, status: true, channel: true,
          total: true, paymentMethod: true, createdAt: true,
        },
      },
    },
  });

  if (!user || user.role !== "CLIENTE") notFound();

  const totalSpent = user.orders
    .reduce((acc, o) => acc + Number(o.total), 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/clientes" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl mb-3">
                {(user.name ?? user.email)[0].toUpperCase()}
              </div>
              <h1 className="text-lg font-bold text-gray-900">{user.name ?? "Sin nombre"}</h1>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>

            <div className="space-y-2 text-sm">
              {user.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  {user.phone}
                </div>
              )}
              {user.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                  {user.email}
                </div>
              )}
              {(user.address || user.city) && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>
                    {[user.address, user.city, user.province].filter(Boolean).join(", ")}
                    {user.postalCode ? ` (${user.postalCode})` : ""}
                  </span>
                </div>
              )}
            </div>

            {(user.dni || user.cuit) && (
              <div className="mt-4 pt-4 border-t text-sm space-y-1">
                {user.dni && <p className="text-gray-500">DNI: <span className="font-medium text-gray-800">{user.dni}</span></p>}
                {user.cuit && <p className="text-gray-500">CUIT: <span className="font-medium text-gray-800">{user.cuit}</span></p>}
              </div>
            )}

            <div className="mt-4 pt-4 border-t text-xs text-gray-400">
              Cliente desde {new Date(user.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-sm text-gray-700">Resumen</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pedidos totales</span>
              <span className="font-bold">{user.orders.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total comprado</span>
              <span className="font-bold text-green-700">{fmt(totalSpent)}</span>
            </div>
            {Number(user.currentCredit) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Crédito disponible</span>
                <span className="font-bold text-blue-700">{fmt(Number(user.currentCredit))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Orders */}
        <div className="lg:col-span-2 rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b">
            <ShoppingBag className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold">Historial de pedidos</h2>
          </div>
          {user.orders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Sin pedidos aún</p>
          ) : (
            <div className="divide-y">
              {user.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/pedidos/${order.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-mono text-xs text-gray-400 shrink-0">#{order.number}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {order.channel === "POS" ? "POS" : "Online"}
                  </span>
                  <span className="flex-1 text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("es-AR")}
                  </span>
                  <span className="font-bold text-sm shrink-0">{fmt(Number(order.total))}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
