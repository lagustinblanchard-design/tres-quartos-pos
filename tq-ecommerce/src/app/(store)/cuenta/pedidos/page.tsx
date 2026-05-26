import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Mis pedidos" };

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparación",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
  DEVUELTO: "Devuelto",
};

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  CONFIRMADO: "bg-blue-100 text-blue-800",
  EN_PREPARACION: "bg-indigo-100 text-indigo-800",
  DESPACHADO: "bg-purple-100 text-purple-800",
  ENTREGADO: "bg-green-100 text-green-800",
  CANCELADO: "bg-gray-100 text-gray-600",
  DEVUELTO: "bg-red-100 text-red-700",
};

export default async function PedidosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id, channel: "ONLINE" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          variant: {
            include: { product: { select: { name: true } } },
          },
        },
      },
    },
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/cuenta" className="text-sm text-gray-400 hover:text-gray-600">
          Mi cuenta
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-300" />
        <span className="text-sm font-medium">Mis pedidos</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Mis pedidos</h1>

      {orders.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center text-gray-400 shadow-sm">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="font-medium text-gray-600">No tenés pedidos todavía</p>
          <p className="text-sm mt-1">Cuando realices una compra, la verás acá</p>
          <Button className="mt-6" asChild>
            <Link href="/catalogo">Explorar productos</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
              {/* Order header */}
              <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
                <div>
                  <p className="font-semibold text-sm">Pedido #{order.number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100"}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <span className="font-bold text-sm">
                    ${Number(order.total).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Order items */}
              <ul className="divide-y">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.variant.product.name}</p>
                      <p className="text-xs text-gray-400">
                        {[item.variant.color, item.variant.size].filter(Boolean).join(" · ")} — x{item.quantity}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 shrink-0">
                      ${Number(item.subtotal).toLocaleString("es-AR")}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Footer */}
              <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {order.shippingAddr
                    ? `Envío a ${order.shippingCity ?? order.shippingAddr}`
                    : "Sin datos de envío"}
                </p>
                <Link
                  href={`/checkout/confirmacion/${order.id}`}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
