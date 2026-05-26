import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Package, MapPin, CreditCard, User } from "lucide-react";
import { OrderStatusPanel } from "@/components/admin/order-status-panel";

export const dynamic = "force-dynamic";

const PAY_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA_DEBITO: "Débito",
  TARJETA_CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  MERCADOPAGO: "MercadoPago",
  MERCADOPAGO_QR: "MP QR",
  CUENTA_CORRIENTE: "Cta. Cte.",
};

const PAY_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PAGADO: "Pagado",
  FALLIDO: "Fallido",
  REEMBOLSADO: "Reembolsado",
};

const PAY_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  PAGADO: "bg-green-100 text-green-800",
  FALLIDO: "bg-red-100 text-red-700",
  REEMBOLSADO: "bg-gray-100 text-gray-600",
};

export default async function PedidoDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { name: true, slug: true } },
            },
          },
        },
      },
      invoices: { select: { id: true, type: true, number: true, createdAt: true } },
    },
  });

  if (!order) notFound();

  const serialized = {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    channel: order.channel,
    mpPaymentId: order.mpPaymentId,
    trackingCode: order.trackingCode,
    notes: order.notes,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    total: Number(order.total),
    createdAt: order.createdAt.toISOString(),
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm text-gray-400">
        <Link href="/admin/pedidos" className="hover:text-gray-600">Pedidos</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-700 font-medium">Pedido #{order.number}</span>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedido #{order.number}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("es-AR", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
            {" — "}
            {new Date(order.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PAY_STATUS_COLORS[order.paymentStatus]}`}>
            Pago: {PAY_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: items + summary */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold">Artículos ({order.items.length})</h2>
            </div>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.variant.product.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      SKU: {item.variant.sku}
                      {item.variant.color ? ` · ${item.variant.color}` : ""}
                      {item.variant.size ? ` · Talle ${item.variant.size}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">${Number(item.unitPrice).toLocaleString("es-AR")}</p>
                    <p className="text-xs text-gray-400">x{item.quantity}</p>
                  </div>
                  <div className="text-right shrink-0 w-24">
                    <p className="text-sm font-bold">${Number(item.subtotal).toLocaleString("es-AR")}</p>
                  </div>
                </li>
              ))}
            </ul>
            {/* Totals */}
            <div className="px-5 py-4 border-t bg-gray-50 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>${Number(order.subtotal).toLocaleString("es-AR")}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Descuento</span>
                  <span>-${Number(order.discount).toLocaleString("es-AR")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600">
                <span>Envío</span>
                <span>{Number(order.shipping) === 0 ? "Gratis" : `$${Number(order.shipping).toLocaleString("es-AR")}`}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                <span>Total</span>
                <span>${Number(order.total).toLocaleString("es-AR")}</span>
              </div>
            </div>
          </div>

          {/* Payment info */}
          <div className="rounded-xl border bg-white shadow-sm p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-500" /> Pago
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Método</p>
                <p className="font-medium">{PAY_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Estado</p>
                <p className="font-medium">{PAY_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</p>
              </div>
              {order.mpPaymentId && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">ID MercadoPago</p>
                  <p className="font-mono text-xs">{order.mpPaymentId}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: status panel + shipping + customer */}
        <div className="space-y-5">
          {/* Status management */}
          <OrderStatusPanel order={serialized} />

          {/* Shipping address */}
          {order.shippingAddr && (
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-gray-500" /> Envío
              </h2>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.shippingName}</p>
                {order.shippingPhone && <p className="text-gray-500">{order.shippingPhone}</p>}
                <p className="text-gray-600">{order.shippingAddr}</p>
                <p className="text-gray-600">
                  {[order.shippingCity, order.shippingProv, order.shippingCp].filter(Boolean).join(", ")}
                </p>
                {order.trackingCode && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-gray-400">Código de seguimiento</p>
                    <p className="font-mono text-sm font-semibold">{order.trackingCode}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer */}
          {order.user && (
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" /> Cliente
              </h2>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.user.name ?? "—"}</p>
                <p className="text-gray-500">{order.user.email}</p>
                {order.user.phone && <p className="text-gray-500">{order.user.phone}</p>}
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h2 className="font-semibold mb-2 text-sm">Notas</h2>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
