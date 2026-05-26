import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoicesTable } from "@/components/admin/invoices-table";

export const metadata = { title: "Facturación — Admin" };
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  REMITO: "Remito",
  NOTA_CREDITO: "Nota Crédito",
  NOTA_DEBITO: "Nota Débito",
  TICKET: "Ticket",
};

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: { type?: string; q?: string; from?: string; to?: string };
}) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invoices, stats] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...(searchParams.type ? { type: searchParams.type as never } : {}),
        ...(searchParams.q ? { OR: [
          { clientName: { contains: searchParams.q, mode: "insensitive" } },
          { clientCuit: { contains: searchParams.q, mode: "insensitive" } },
        ]} : {}),
        ...(searchParams.from || searchParams.to ? {
          createdAt: {
            ...(searchParams.from ? { gte: new Date(searchParams.from) } : {}),
            ...(searchParams.to ? { lte: new Date(searchParams.to + "T23:59:59") } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { order: { select: { number: true } } },
    }),
    prisma.invoice.aggregate({
      where: { createdAt: { gte: firstOfMonth }, cancelledAt: null },
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  const byType = await prisma.invoice.groupBy({
    by: ["type"],
    where: { createdAt: { gte: firstOfMonth }, cancelledAt: null },
    _count: { id: true },
    _sum: { total: true },
  });

  const typeMap = Object.fromEntries(byType.map((b) => [b.type, { count: b._count.id, total: Number(b._sum.total ?? 0) }]));

  const serialized = invoices.map((inv) => ({
    id: inv.id,
    type: inv.type,
    series: inv.series,
    number: inv.number,
    clientName: inv.clientName,
    clientCuit: inv.clientCuit ?? null,
    subtotal: Number(inv.subtotal),
    iva: Number(inv.iva),
    total: Number(inv.total),
    afipCae: inv.afipCae,
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    orderNumber: inv.order?.number ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
          <p className="text-sm text-gray-500 mt-1">Comprobantes emitidos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button asChild>
            <Link href="/admin/facturacion/nueva">
              <Plus className="h-4 w-4 mr-1" /> Nuevo comprobante
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total facturado (mes)</p>
          <p className="text-2xl font-bold mt-1">
            ${Number(stats._sum.total ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-400">{stats._count.id} comprobantes</p>
        </div>
        {["FACTURA_A", "FACTURA_B", "TICKET"].map((t) => (
          <div key={t} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">{TYPE_LABELS[t]} (mes)</p>
            <p className="text-2xl font-bold mt-1">{typeMap[t]?.count ?? 0}</p>
            <p className="text-xs text-gray-400">
              ${(typeMap[t]?.total ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 0 })}
            </p>
          </div>
        ))}
      </div>

      <InvoicesTable invoices={serialized} />
    </div>
  );
}
