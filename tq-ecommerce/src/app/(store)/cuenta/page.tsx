import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/store/sign-out-button";

export const metadata = { title: "Mi cuenta" };

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

export default async function CuentaPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      orders: {
        where: { channel: "ONLINE" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
          items: { select: { id: true } },
        },
      },
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">Mi cuenta</h1>

      {/* Profile card */}
      <div className="rounded-xl border bg-white p-6 flex items-center gap-5 mb-6 shadow-sm">
        <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <User className="h-7 w-7 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg truncate">{user.name}</p>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Cliente desde {new Date(user.createdAt).toLocaleDateString("es-AR", { year: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/cuenta/perfil">
              <User className="h-4 w-4 mr-1" /> Editar perfil
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-500" /> Mis pedidos recientes
          </h2>
          <Link href="/cuenta/pedidos" className="text-sm text-blue-600 hover:underline">
            Ver todos
          </Link>
        </div>

        {user.orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Todavía no realizaste ningún pedido.</p>
            <Button className="mt-4" asChild>
              <Link href="/catalogo">Explorar productos</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {user.orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/cuenta/pedidos/${order.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Pedido #{order.number}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {order.items.length} {order.items.length === 1 ? "artículo" : "artículos"}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100"}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0">
                    ${Number(order.total).toLocaleString("es-AR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Link
          href="/cuenta/pedidos"
          className="rounded-xl border bg-white p-5 hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <Package className="h-6 w-6 text-blue-600 mb-2" />
          <p className="font-medium text-sm">Historial de pedidos</p>
          <p className="text-xs text-gray-400 mt-0.5">Ver todos tus pedidos</p>
        </Link>
        <Link
          href="/cuenta/perfil"
          className="rounded-xl border bg-white p-5 hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <User className="h-6 w-6 text-blue-600 mb-2" />
          <p className="font-medium text-sm">Mis datos</p>
          <p className="text-xs text-gray-400 mt-0.5">Actualizar información personal</p>
        </Link>
      </div>
    </div>
  );
}
