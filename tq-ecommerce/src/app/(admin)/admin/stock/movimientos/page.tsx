import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ArrowUp, ArrowDown, SlidersHorizontal } from "lucide-react";

export const metadata = { title: "Historial de Stock | Admin" };
export const dynamic = "force-dynamic";

async function getMovements() {
  return prisma.stockMovement.findMany({
    include: {
      variant: {
        include: {
          product: { select: { name: true, sku: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ENTRADA: {
    label: "Entrada",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <ArrowUp className="h-3.5 w-3.5" />,
  },
  SALIDA: {
    label: "Salida",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <ArrowDown className="h-3.5 w-3.5" />,
  },
  AJUSTE: {
    label: "Ajuste",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
  },
  VENTA: {
    label: "Venta",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: <ArrowDown className="h-3.5 w-3.5" />,
  },
  DEVOLUCION: {
    label: "Devolución",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <ArrowUp className="h-3.5 w-3.5" />,
  },
};

export default async function MovimientosPage() {
  const movements = await getMovements();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/stock">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Stock
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Historial de movimientos</h1>
          <p className="text-sm text-gray-500">{movements.length} movimientos recientes</p>
        </div>
      </div>

      {/* Filters (server-rendered for now) */}
      <Card>
        <CardContent className="p-4">
          <form className="flex flex-wrap gap-3">
            <select name="type" className="rounded-md border px-3 py-2 text-sm bg-white">
              <option value="">Todos los tipos</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SALIDA">Salida</option>
              <option value="AJUSTE">Ajuste</option>
              <option value="VENTA">Venta</option>
              <option value="DEVOLUCION">Devolución</option>
            </select>
            <input type="date" name="from" className="rounded-md border px-3 py-2 text-sm bg-white" />
            <input type="date" name="to" className="rounded-md border px-3 py-2 text-sm bg-white" />
            <Button type="submit" size="sm" variant="outline">Filtrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left">
                <tr>
                  <th className="p-4 font-medium text-gray-500">Fecha y hora</th>
                  <th className="p-4 font-medium text-gray-500">Tipo</th>
                  <th className="p-4 font-medium text-gray-500">Producto / Variante</th>
                  <th className="p-4 font-medium text-gray-500 text-center">Anterior</th>
                  <th className="p-4 font-medium text-gray-500 text-center">Cambio</th>
                  <th className="p-4 font-medium text-gray-500 text-center">Nuevo</th>
                  <th className="p-4 font-medium text-gray-500">Motivo</th>
                  <th className="p-4 font-medium text-gray-500">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-gray-400">
                      No hay movimientos registrados aún
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const config = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.AJUSTE;
                    const delta = m.newQty - m.previousQty;
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        {/* Date */}
                        <td className="p-4 text-gray-500 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                          <br />
                          <span className="text-xs text-gray-400">
                            {new Date(m.createdAt).toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
                            {config.icon}
                            {config.label}
                          </span>
                        </td>

                        {/* Product */}
                        <td className="p-4">
                          <p className="font-medium leading-tight">{m.variant.product.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[m.variant.color, m.variant.size].filter(Boolean).join(" / ")}
                          </p>
                          <p className="text-xs font-mono text-gray-400">{m.variant.sku}</p>
                        </td>

                        {/* Previous */}
                        <td className="p-4 text-center font-mono text-gray-500">{m.previousQty}</td>

                        {/* Delta */}
                        <td className="p-4 text-center">
                          <span
                            className={`font-bold font-mono ${
                              delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-gray-400"
                            }`}
                          >
                            {delta > 0 ? "+" : ""}{delta}
                          </span>
                        </td>

                        {/* New */}
                        <td className="p-4 text-center font-mono font-bold">{m.newQty}</td>

                        {/* Reason */}
                        <td className="p-4 text-gray-600 max-w-xs">
                          {m.reason ?? <span className="text-gray-300">—</span>}
                        </td>

                        {/* Reference */}
                        <td className="p-4 font-mono text-xs text-gray-400">
                          {m.reference ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
