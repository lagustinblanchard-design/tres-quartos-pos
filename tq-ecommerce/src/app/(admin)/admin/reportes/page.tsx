import { prisma } from "@/lib/prisma";
import { BarChart2, TrendingUp, ShoppingCart, Package, Monitor } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes — Admin" };

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

const PERIOD_DAYS: Record<string, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
  "365": 365,
};

const PAY_LABELS: Record<string, string> = {
  MERCADOPAGO: "MercadoPago",
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  TARJETA_DEBITO: "Débito",
  TARJETA_CREDITO: "Crédito",
  MERCADOPAGO_QR: "MP QR",
  CUENTA_CORRIENTE: "Cta. Cte.",
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const period = PERIOD_DAYS[searchParams.period ?? "30"] ? (searchParams.period ?? "30") : "30";
  const days = PERIOD_DAYS[period];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(Date.now() - 2 * days * 24 * 60 * 60 * 1000);

  const [
    salesCurrent,
    salesPrev,
    ordersByDay,
    topProducts,
    paymentBreakdown,
    channelBreakdown,
    topClients,
  ] = await Promise.all([
    // Current period totals
    prisma.order.aggregate({
      where: { createdAt: { gte: since }, paymentStatus: "PAGADO" },
      _sum: { total: true },
      _count: { id: true },
    }),
    // Previous period totals
    prisma.order.aggregate({
      where: { createdAt: { gte: prevSince, lt: since }, paymentStatus: "PAGADO" },
      _sum: { total: true },
      _count: { id: true },
    }),
    // Orders by day (last 30 days max)
    prisma.$queryRaw<{ day: Date; total: number; count: number }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt") as day,
        SUM(total)::float as total,
        COUNT(*)::int as count
      FROM orders
      WHERE "createdAt" >= ${since}
        AND "paymentStatus" = 'PAGADO'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `,
    // Top products by revenue
    prisma.$queryRaw<{ name: string; qty: number; revenue: number }[]>`
      SELECT
        p.name,
        SUM(oi.quantity)::int as qty,
        SUM(oi.subtotal)::float as revenue
      FROM order_items oi
      JOIN product_variants pv ON pv.id = oi."variantId"
      JOIN products p ON p.id = pv."productId"
      JOIN orders o ON o.id = oi."orderId"
      WHERE o."createdAt" >= ${since}
        AND o."paymentStatus" = 'PAGADO'
      GROUP BY p.name
      ORDER BY revenue DESC
      LIMIT 10
    `,
    // Payment method breakdown
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { createdAt: { gte: since }, paymentStatus: "PAGADO" },
      _sum: { total: true },
      _count: { id: true },
    }),
    // Channel breakdown
    prisma.order.groupBy({
      by: ["channel"],
      where: { createdAt: { gte: since }, paymentStatus: "PAGADO" },
      _sum: { total: true },
      _count: { id: true },
    }),
    // Top clients
    prisma.$queryRaw<{ name: string; email: string; orders: number; spent: number }[]>`
      SELECT
        COALESCE(u.name, o."shippingName", o."guestName", 'Invitado') as name,
        COALESCE(u.email, o."guestEmail", '') as email,
        COUNT(o.id)::int as orders,
        SUM(o.total)::float as spent
      FROM orders o
      LEFT JOIN users u ON u.id = o."userId"
      WHERE o."createdAt" >= ${since}
        AND o."paymentStatus" = 'PAGADO'
      GROUP BY COALESCE(u.name, o."shippingName", o."guestName", 'Invitado'),
               COALESCE(u.email, o."guestEmail", '')
      ORDER BY spent DESC
      LIMIT 10
    `,
  ]);

  const currentTotal = Number(salesCurrent._sum.total ?? 0);
  const prevTotal = Number(salesPrev._sum.total ?? 0);
  const change = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : null;

  const payTotal = paymentBreakdown.reduce((acc, r) => acc + Number(r._sum.total ?? 0), 0);
  const maxRevenue = topProducts.length > 0 ? topProducts[0].revenue : 1;

  // Build day-by-day data for bar chart (last 30 days max, capped at 30)
  const chartDays = Math.min(days, 30);
  const dayMap = new Map<string, number>();
  for (const row of ordersByDay) {
    dayMap.set(new Date(row.day).toISOString().split("T")[0], Number(row.total));
  }
  const chartData: { label: string; value: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    chartData.push({
      label: d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
      value: dayMap.get(key) ?? 0,
    });
  }
  const maxChart = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análisis de ventas y rendimiento</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1">
          {[["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["365", "1 año"]].map(([val, label]) => (
            <a
              key={val}
              href={`?period=${val}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === val
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Ingresos</p>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{fmt(currentTotal)}</p>
          {change !== null && (
            <p className={`text-xs mt-1 ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs período anterior
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Pedidos</p>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{salesCurrent._count.id}</p>
          <p className="text-xs text-gray-400 mt-1">vs {salesPrev._count.id} período anterior</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Ticket promedio</p>
            <BarChart2 className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">
            {salesCurrent._count.id > 0 ? fmt(Math.round(currentTotal / salesCurrent._count.id)) : "$0"}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Online vs POS</p>
            <Monitor className="h-5 w-5 text-indigo-500" />
          </div>
          {channelBreakdown.map((ch) => (
            <div key={ch.channel} className="flex justify-between text-sm">
              <span className="text-gray-500">{ch.channel === "POS" ? "POS" : "Online"}</span>
              <span className="font-semibold">{fmt(Number(ch._sum.total ?? 0))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sales chart */}
      {chartDays <= 30 && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold mb-4">Ventas por día</h2>
          <div className="flex items-end gap-1 h-36 overflow-x-auto pb-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[24px]">
                <div
                  className="w-full rounded-t bg-blue-500 min-h-[2px] transition-all"
                  style={{ height: `${Math.round((d.value / maxChart) * 128)}px` }}
                  title={fmt(d.value)}
                />
                {chartDays <= 14 && (
                  <span className="text-[10px] text-gray-400 rotate-45 origin-left whitespace-nowrap">{d.label}</span>
                )}
              </div>
            ))}
          </div>
          {chartDays > 14 && (
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{chartData[0]?.label}</span>
              <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
              <span>{chartData[chartData.length - 1]?.label}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b">
            <Package className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold">Top productos</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Sin datos en este período</p>
          ) : (
            <ul className="divide-y">
              {topProducts.map((p, i) => (
                <li key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{p.name}</span>
                    <span className="text-sm font-bold shrink-0 ml-2">{fmt(Number(p.revenue))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.round((Number(p.revenue) / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{p.qty} u.</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Payment methods */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold">Métodos de pago</h2>
            </div>
            {paymentBreakdown.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Sin datos</p>
            ) : (
              <ul className="divide-y">
                {paymentBreakdown
                  .sort((a, b) => Number(b._sum.total ?? 0) - Number(a._sum.total ?? 0))
                  .map((pm) => {
                    const amt = Number(pm._sum.total ?? 0);
                    const pct = payTotal > 0 ? Math.round((amt / payTotal) * 100) : 0;
                    return (
                      <li key={pm.paymentMethod} className="px-5 py-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{PAY_LABELS[pm.paymentMethod] ?? pm.paymentMethod}</span>
                          <div className="text-right">
                            <span className="font-semibold">{fmt(amt)}</span>
                            <span className="text-gray-400 ml-2 text-xs">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          {/* Top clients */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold">Top clientes</h2>
            </div>
            {topClients.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400 text-center">Sin datos</p>
            ) : (
              <ul className="divide-y">
                {topClients.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-xs font-bold text-gray-400 w-4 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fmt(Number(c.spent))}</p>
                      <p className="text-xs text-gray-400">{c.orders} pedidos</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
