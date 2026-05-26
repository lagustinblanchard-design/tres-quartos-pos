import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users, Search, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes — Admin" };

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 20;

  const where = q
    ? {
        role: "CLIENTE" as const,
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { role: "CLIENTE" as const };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: {
          where: { paymentStatus: "PAGADO" },
          select: { total: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const clients = users.map((u) => ({
    id: u.id,
    name: u.name ?? "Sin nombre",
    email: u.email,
    phone: u.phone,
    city: u.city,
    createdAt: u.createdAt,
    orderCount: u._count.orders,
    totalSpent: u.orders.reduce((acc, o) => acc + Number(o.total), 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString("es-AR")} clientes registrados</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-4 py-1.5 text-sm font-medium">
          <Users className="h-4 w-4" />
          {total}
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, email o teléfono..."
            className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
          Buscar
        </button>
        {q && (
          <Link href="/admin/clientes" className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Limpiar
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {clients.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{q ? "No se encontraron clientes" : "No hay clientes registrados"}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-5 py-3 font-medium text-gray-500">Cliente</th>
                <th className="px-5 py-3 font-medium text-gray-500">Contacto</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-center">Pedidos</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Total comprado</th>
                <th className="px-5 py-3 font-medium text-gray-500">Registrado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {c.phone && <p>{c.phone}</p>}
                    {c.city && <p className="text-xs text-gray-400">{c.city}</p>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
                      {c.orderCount}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">
                    {fmt(c.totalSpent)}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(c.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      Ver <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/clientes?${q ? `q=${q}&` : ""}page=${page - 1}`}
                className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/clientes?${q ? `q=${q}&` : ""}page=${page + 1}`}
                className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
