import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceCancelButton } from "@/components/admin/invoice-cancel-button";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  REMITO: "Remito",
  NOTA_CREDITO: "Nota de Crédito",
  NOTA_DEBITO: "Nota de Débito",
  TICKET: "Ticket",
};

function padNum(n: number) { return String(n).padStart(8, "0"); }
function fmt(n: number) { return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2 }); }

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          items: {
            include: { variant: { include: { product: { select: { name: true } } } } },
          },
        },
      },
    },
  });

  if (!invoice) notFound();

  const isCancelled = !!invoice.cancelledAt;
  const subtotal = Number(invoice.subtotal);
  const iva = Number(invoice.iva);
  const total = Number(invoice.total);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm text-gray-400">
        <Link href="/admin/facturacion" className="hover:text-gray-600">Facturación</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-700 font-medium">{TYPE_LABELS[invoice.type]} {invoice.series}-{padNum(invoice.number)}</span>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {TYPE_LABELS[invoice.type]} N° {invoice.series}-{padNum(invoice.number)}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date(invoice.createdAt).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCancelled && (
            <span className="rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold">ANULADO</span>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/facturacion/${invoice.id}/imprimir`} target="_blank">
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Link>
          </Button>
          {!isCancelled && <InvoiceCancelButton id={invoice.id} />}
        </div>
      </div>

      {/* Invoice body */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-2 gap-6 p-6 border-b bg-gray-50">
          <div>
            <p className="text-xs text-gray-400 mb-1">Emisor</p>
            <p className="font-bold text-lg">TQ Deportes</p>
            <p className="text-sm text-gray-600">Punto de venta: {invoice.series}</p>
          </div>
          <div className="text-right">
            <span className={`inline-block rounded-lg px-4 py-2 text-2xl font-black border-2 ${invoice.type === "FACTURA_A" ? "border-blue-600 text-blue-600" : "border-gray-800 text-gray-800"}`}>
              {invoice.type === "FACTURA_A" ? "A" : invoice.type === "FACTURA_B" ? "B" : invoice.type === "TICKET" ? "T" : invoice.type === "REMITO" ? "R" : invoice.type === "NOTA_CREDITO" ? "NC" : "ND"}
            </span>
          </div>
        </div>

        {/* Client info */}
        <div className="grid grid-cols-2 gap-6 p-6 border-b">
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Cliente</p>
            <p className="font-semibold">{invoice.clientName}</p>
            {invoice.clientCuit && <p className="text-sm text-gray-600">CUIT: {invoice.clientCuit}</p>}
            {invoice.clientDni && <p className="text-sm text-gray-600">DNI: {invoice.clientDni}</p>}
            {invoice.clientEmail && <p className="text-sm text-gray-600">{invoice.clientEmail}</p>}
            {invoice.clientAddr && <p className="text-sm text-gray-600">{invoice.clientAddr}</p>}
          </div>
          {invoice.order && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Pedido asociado</p>
              <Link href={`/admin/pedidos/${invoice.order.id}`} className="text-blue-600 hover:underline font-medium">
                #{invoice.order.number}
              </Link>
            </div>
          )}
          {invoice.afipCae && (
            <div>
              <p className="text-xs text-gray-400 mb-1">CAE AFIP</p>
              <p className="font-mono text-sm">{invoice.afipCae}</p>
            </div>
          )}
        </div>

        {/* Items */}
        {invoice.order && (
          <div className="p-6 border-b">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Detalle</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="text-left pb-2">Descripción</th>
                  <th className="text-right pb-2">Cant.</th>
                  <th className="text-right pb-2">P. Unit.</th>
                  <th className="text-right pb-2">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.order.items.map((item) => (
                  <tr key={item.id} className="text-gray-700">
                    <td className="py-2">
                      <p className="font-medium">{item.variant.product.name}</p>
                      <p className="text-xs text-gray-400">
                        {[item.variant.color, item.variant.size ? `T.${item.variant.size}` : null].filter(Boolean).join(" ")}
                      </p>
                    </td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{fmt(Number(item.unitPrice))}</td>
                    <td className="py-2 text-right font-medium">{fmt(Number(item.subtotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="p-6">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal {invoice.type === "FACTURA_A" ? "(sin IVA)" : ""}</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {iva > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>IVA 21%</span>
                <span>{fmt(iva)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>TOTAL</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
