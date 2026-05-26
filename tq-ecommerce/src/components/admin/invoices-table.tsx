"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Eye, Printer, XCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Invoice = {
  id: string;
  type: string;
  series: string;
  number: number;
  clientName: string;
  clientCuit: string | null;
  subtotal: number;
  iva: number;
  total: number;
  afipCae: string | null;
  cancelledAt: string | null;
  createdAt: string;
  orderNumber: number | null;
};

const TYPE_LABELS: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  REMITO: "Remito",
  NOTA_CREDITO: "N. Crédito",
  NOTA_DEBITO: "N. Débito",
  TICKET: "Ticket",
};

const TYPE_COLORS: Record<string, string> = {
  FACTURA_A: "bg-blue-100 text-blue-800",
  FACTURA_B: "bg-indigo-100 text-indigo-800",
  REMITO: "bg-gray-100 text-gray-700",
  NOTA_CREDITO: "bg-red-100 text-red-700",
  NOTA_DEBITO: "bg-orange-100 text-orange-700",
  TICKET: "bg-green-100 text-green-800",
};

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function padNumber(n: number) {
  return String(n).padStart(8, "0");
}

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k); });
    router.push(`${pathname}?${sp.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: search });
  }

  async function handleCancel(id: string) {
    if (!confirm("¿Confirmar anulación del comprobante? Esta acción no se puede deshacer.")) return;
    setCancellingId(id);
    await fetch(`/api/admin/facturacion/${id}`, { method: "PATCH" });
    setCancellingId(null);
    router.refresh();
  }

  const activeTab = searchParams.get("type") ?? "";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente o CUIT..." className="pl-9" />
          </div>
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>
        <select
          className="rounded-md border text-sm px-3 py-2 bg-white"
          value={activeTab}
          onChange={(e) => navigate({ type: e.target.value })}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          type="date"
          className="rounded-md border text-sm px-3 py-2 bg-white"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => navigate({ from: e.target.value })}
        />
        <span className="text-sm text-gray-400">→</span>
        <input
          type="date"
          className="rounded-md border text-sm px-3 py-2 bg-white"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => navigate({ to: e.target.value })}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {invoices.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay comprobantes que coincidan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Número</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Pedido</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id} className={`hover:bg-gray-50 transition-colors ${inv.cancelledAt ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[inv.type] ?? "bg-gray-100 text-gray-700"}`}>
                        {TYPE_LABELS[inv.type] ?? inv.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {inv.series}-{padNumber(inv.number)}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="font-medium truncate">{inv.clientName}</p>
                      {inv.clientCuit && <p className="text-xs text-gray-400">{inv.clientCuit}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {inv.orderNumber ? (
                        <Link href={`/admin/pedidos`} className="text-xs text-blue-600 hover:underline">
                          #{inv.orderNumber}
                        </Link>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(inv.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(inv.iva)}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmt(inv.total)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.cancelledAt ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">Anulado</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">Emitido</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild title="Ver / Imprimir">
                          <Link href={`/admin/facturacion/${inv.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild title="Imprimir">
                          <Link href={`/admin/facturacion/${inv.id}/imprimir`} target="_blank"><Printer className="h-4 w-4" /></Link>
                        </Button>
                        {!inv.cancelledAt && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Anular"
                            disabled={cancellingId === inv.id}
                            onClick={() => handleCancel(inv.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
