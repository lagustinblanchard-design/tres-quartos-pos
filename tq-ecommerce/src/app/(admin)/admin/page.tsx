import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  TrendingUp, ShoppingCart, Package, Users,
  AlertTriangle, DollarSign, ArrowRight, Monitor,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Admin" };

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente", CONFIRMADO: "Confirmado", EN_PREPARACION: "En preparación",
  DESPACHADO: "Despachado", ENTREGADO: "Entregado", CANCELADO: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800", CONFIRMADO: "bg-blue-100 text-blue-800",
  EN_PREPARACION: "bg-indigo-100 text-indigo-800", DESPACHADO: "bg-purple-100 text-purple-800",
  ENTREGADO: "bg-green-100 text-green-800", CANCELADO: "bg-gray-100 text-gray-600",
};

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    salesToday,
    salesMonth,
    salesLastMonth,
    pendingOrders,
    recentOrders,
    activeProducts,
    outOfStock,
    totalClients,
    newClientsThisWeek,
    lowStockVariants,
    posSessionToday,
    monthInvoiced,
  ] = await Promise.all([
    // Ventas hoy (online + POS, pagadas)
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfDay }, paymentStatus: "PAGADO" },
      _sum: { total: true },
      _count: { id: true },
    }),
    // Ventas este mes
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfMonth }, paymentStatus: "PAGADO" },
      _sum: { total: true },
    }),
    // Ventas mes anterior (para comparación)
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, paymentStatus: "PAGADO" },
      _sum: { total: true },
    }),
    // Pedidos pendientes (online)
    prisma.order.count({
      where: { channel: "ONLINE", status: { in: ["PENDIENTE", "CONFIRMADO", "EN_PREPARACION"] } },
    }),
    // Últimos 8 pedidos
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, number: true, status: true, channel: true, total: true, createdAt: true,
        user: { select: { name: true } },
        shippingName: true, guestName: true,
      },
    }),
    // Productos activos
    prisma.product.count({ where: { isActive: true } }),
    // Variantes sin stock (activas)
    prisma.productVariant.count({ where: { isActive: true, stock: 0 } }),
    // Total clientes registrados
    prisma.user.count({ where: { role: "CLIENTE" } }),
    // Nuevos clientes esta semana
    prisma.user.count({
      where: {
        role: "CLIENTE",
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    // Stock crítico (stock > 0 pero <= alerta)
    prisma.productVariant.findMany({
      where: { isActive: true, stock: { gt: 0 }, product: { isActive: true } },
      select: {
        id: true, stock: true, stockAlert: true, size: true, color: true,
        product: { select: { name: true } },
      },
      orderBy: { stock: "asc" },
      take: 50,
    }),
    // Sesión POS abierta hoy
    prisma.posSession.findFirst({
      where: { openedAt: { gte: startOfDay }, closedAt: null },
      select: { id: true, totalSales: true, openedAt: true },
    }),
    // Total facturado este mes
    prisma.invoice.aggregate({
      where: { createdAt: { gte: startOfMonth }, cancelledAt: null },
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  const todayTotal = Number(salesToday._sum.total ?? 0);
  const monthTotal = Number(salesMonth._sum.total ?? 0);
  const lastMonthTotal = Number(salesLastMonth._sum.total ?? 0);
  const monthChange = lastMonthTotal > 0
    ? Math.round(((monthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : null;

  // Filter critical stock variants
  const criticalStock = lowStockVariants
    .filter((v) => v.stock <= v.stockAlert)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {posSessionToday && (
          <div className="flex items-center gap-2 rounded-full bg-green-100 text-green-800 px-4 py-1.5 text-sm font-medium">
            <Monitor className="h-4 w-4" />
            Caja abierta · POS: {fmt(Number(posSessionToday.totalSales))}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas hoy */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 font-medium">Ventas hoy</p>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{fmt(todayTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{salesToday._count.id} transacciones</p>
        </div>

        {/* Ventas del mes */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 font-medium">Ventas del mes</p>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{fmt(monthTotal)}</p>
          {monthChange !== null && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${monthChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {monthChange >= 0 ? "▲" : "▼"} {Math.abs(monthChange)}% vs mes anterior
            </p>
          )}
        </div>

        {/* Pedidos pendientes */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 font-medium">Pedidos pendientes</p>
            <ShoppingCart className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold">{pendingOrders}</p>
          <Link href="/admin/pedidos?status=PENDIENTE" className="text-xs text-blue-600 hover:underline mt-1 block">
            Ver pendientes →
          </Link>
        </div>

        {/* Clientes */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 font-medium">Clientes registrados</p>
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{totalClients.toLocaleString("es-AR")}</p>
          <p className="text-xs text-gray-400 mt-1">+{newClientsThisWeek} esta semana</p>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">Productos activos</p>
            <Package className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="text-xl font-bold">{activeProducts}</p>
          <p className="text-xs text-red-500 mt-0.5">{outOfStock} sin stock</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">Facturado este mes</p>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-xl font-bold">{fmt(Number(monthInvoiced._sum.total ?? 0))}</p>
          <p className="text-xs text-gray-400 mt-0.5">{monthInvoiced._count.id} comprobantes</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">Stock crítico</p>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-xl font-bold">{criticalStock.length}</p>
          <Link href="/admin/stock" className="text-xs text-blue-600 hover:underline mt-0.5 block">
            Ver inventario →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold">Pedidos recientes</h2>
            <Link href="/admin/pedidos" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No hay pedidos aún</p>
            ) : recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/pedidos/${order.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="font-mono text-xs text-gray-400 shrink-0">#{order.number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {order.user?.name ?? order.shippingName ?? order.guestName ?? "Consumidor final"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {order.channel === "POS" ? "POS" : "Online"} ·{" "}
                    {new Date(order.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
                <span className="text-sm font-bold shrink-0">{fmt(Number(order.total))}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Stock crítico */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Stock crítico
            </h2>
            <Link href="/admin/stock" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              Ver todo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {criticalStock.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Stock en niveles normales</p>
          ) : (
            <ul className="divide-y">
              {criticalStock.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.product.name}</p>
                    <p className="text-xs text-gray-400">
                      {[v.color, v.size ? `T.${v.size}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={`ml-3 shrink-0 font-bold text-sm ${v.stock === 0 ? "text-red-600" : "text-amber-600"}`}>
                    {v.stock} u.
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Quick links */}
          <div className="border-t px-5 py-4 grid grid-cols-2 gap-2">
            <Link href="/admin/pedidos?status=PENDIENTE" className="rounded-lg border text-center py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Pendientes
            </Link>
            <Link href="/admin/facturacion/nueva" className="rounded-lg border text-center py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Nueva factura
            </Link>
            <Link href="/admin/productos/nuevo" className="rounded-lg border text-center py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Nuevo producto
            </Link>
            <Link href="/admin/pos" className="rounded-lg border text-center py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Abrir POS
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
