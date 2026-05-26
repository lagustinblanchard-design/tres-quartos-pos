import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  FACTURA_A: "FACTURA A",
  FACTURA_B: "FACTURA B",
  REMITO: "REMITO",
  NOTA_CREDITO: "NOTA DE CRÉDITO",
  NOTA_DEBITO: "NOTA DE DÉBITO",
  TICKET: "TICKET",
};

function padNum(n: number) { return String(n).padStart(8, "0"); }
function fmt(n: number) { return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2 }); }

export default async function ImprimirPage({ params }: { params: { id: string } }) {
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

  const subtotal = Number(invoice.subtotal);
  const iva = Number(invoice.iva);
  const total = Number(invoice.total);
  const typeCode = invoice.type === "FACTURA_A" ? "A" : invoice.type === "FACTURA_B" ? "B" : invoice.type === "TICKET" ? "T" : invoice.type === "REMITO" ? "R" : invoice.type === "NOTA_CREDITO" ? "NC" : "ND";

  return (
    <html lang="es">
      <head>
        <title>{TYPE_LABELS[invoice.type]} {invoice.series}-{padNum(invoice.number)}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: white; padding: 20px; }
          .page { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 20px; }
          .type-code { font-size: 48px; font-weight: 900; border: 3px solid #111; padding: 8px 20px; line-height: 1; }
          .company { font-size: 20px; font-weight: bold; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .section-title { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 6px; letter-spacing: 0.05em; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: left; border-bottom: 1px solid #333; padding: 6px 4px; font-size: 11px; text-transform: uppercase; color: #555; }
          td { padding: 6px 4px; border-bottom: 1px solid #eee; }
          .text-right { text-align: right; }
          .totals { float: right; width: 280px; }
          .totals tr td { border: none; }
          .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid #111 !important; }
          .cancelled-stamp { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(220,0,0,0.15); pointer-events: none; white-space: nowrap; }
          .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; font-size: 10px; color: #888; text-align: center; }
          @media print { .no-print { display: none !important; } body { padding: 0; } }
        `}</style>
      </head>
      <body>
        {invoice.cancelledAt && <div className="cancelled-stamp">ANULADO</div>}

        <PrintButton />

        <div className="page">
          {/* Header */}
          <div className="header">
            <div>
              <div className="company">TQ Deportes</div>
              <div style={{ marginTop: 6, color: "#555" }}>
                <div>{TYPE_LABELS[invoice.type]}</div>
                <div>Punto de venta: {invoice.series}</div>
                <div>Comprobante N°: {invoice.series}-{padNum(invoice.number)}</div>
                <div>Fecha: {new Date(invoice.createdAt).toLocaleDateString("es-AR")}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="type-code">{typeCode}</div>
              {invoice.afipCae && (
                <div style={{ marginTop: 8, fontSize: 10, color: "#555" }}>
                  <div>CAE: {invoice.afipCae}</div>
                  {invoice.afipVto && <div>Vto.: {new Date(invoice.afipVto).toLocaleDateString("es-AR")}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Client info */}
          <div className="meta">
            <div>
              <div className="section-title">Receptor</div>
              <div style={{ fontWeight: "bold" }}>{invoice.clientName}</div>
              {invoice.clientCuit && <div>CUIT: {invoice.clientCuit}</div>}
              {invoice.clientDni && <div>DNI: {invoice.clientDni}</div>}
              {invoice.clientEmail && <div>{invoice.clientEmail}</div>}
              {invoice.clientAddr && <div>{invoice.clientAddr}</div>}
            </div>
            {invoice.order && (
              <div>
                <div className="section-title">Pedido</div>
                <div>#{invoice.order.number}</div>
              </div>
            )}
          </div>

          {/* Items */}
          {invoice.order && invoice.order.items.length > 0 && (
            <>
              <div className="section-title">Detalle</div>
              <table>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">P. Unitario</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.variant.product.name}
                        {(item.variant.color || item.variant.size) && (
                          <span style={{ color: "#666", fontSize: 10 }}>
                            {" "}({[item.variant.color, item.variant.size ? `T.${item.variant.size}` : null].filter(Boolean).join(" ")})
                          </span>
                        )}
                      </td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{fmt(Number(item.unitPrice))}</td>
                      <td className="text-right">{fmt(Number(item.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Totals */}
          <table className="totals">
            <tbody>
              <tr>
                <td>Subtotal{invoice.type === "FACTURA_A" ? " (neto)" : ""}:</td>
                <td className="text-right">{fmt(subtotal)}</td>
              </tr>
              {iva > 0 && (
                <tr>
                  <td>IVA 21%:</td>
                  <td className="text-right">{fmt(iva)}</td>
                </tr>
              )}
              <tr className="total-row">
                <td>TOTAL:</td>
                <td className="text-right">{fmt(total)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ clear: "both" }} />

          <div className="footer">
            <p>TQ Deportes — Comprobante generado el {new Date().toLocaleString("es-AR")}</p>
            {invoice.cancelledAt && (
              <p style={{ color: "red", fontWeight: "bold", marginTop: 4 }}>
                COMPROBANTE ANULADO — {new Date(invoice.cancelledAt).toLocaleString("es-AR")}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
