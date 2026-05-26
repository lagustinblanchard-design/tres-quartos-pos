import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Package,
  ArrowRight,
  Copy,
} from "lucide-react";

type Props = {
  params: { orderId: string };
  searchParams: { status?: string; method?: string };
};

async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                select: { name: true, slug: true, images: { take: 1, orderBy: { position: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
}

// Estado visual según status de la URL (devuelto por MP) y status real en DB
function resolveStatus(urlStatus: string | undefined, paymentStatus: string) {
  if (paymentStatus === "PAGADO" || urlStatus === "success") {
    return "success" as const;
  }
  if (urlStatus === "failure" || paymentStatus === "FALLIDO") {
    return "failure" as const;
  }
  return "pending" as const;
}

const STATUS_CONFIG = {
  success: {
    icon: <CheckCircle2 className="h-16 w-16 text-green-500" />,
    title: "¡Pago confirmado!",
    subtitle: "Tu pedido está siendo preparado. Te avisamos cuando esté en camino.",
    badgeVariant: "success" as const,
    badgeLabel: "Pago aprobado",
    bg: "from-green-50 to-white",
  },
  pending: {
    icon: <Clock className="h-16 w-16 text-amber-500" />,
    title: "Pedido recibido",
    subtitle: "Estamos esperando la confirmación del pago. Te notificaremos por email.",
    badgeVariant: "warning" as const,
    badgeLabel: "Pago pendiente",
    bg: "from-amber-50 to-white",
  },
  failure: {
    icon: <XCircle className="h-16 w-16 text-red-500" />,
    title: "El pago no se completó",
    subtitle: "No se realizó ningún cargo. Podés intentarlo de nuevo.",
    badgeVariant: "destructive" as const,
    badgeLabel: "Pago rechazado",
    bg: "from-red-50 to-white",
  },
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirmación de compra" };

export default async function ConfirmacionPage({ params, searchParams }: Props) {
  const order = await getOrder(params.orderId);
  if (!order) notFound();

  const status = resolveStatus(searchParams.status, order.paymentStatus);
  const config = STATUS_CONFIG[status];
  const isTransfer = searchParams.method === "transferencia";

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {/* Status card */}
      <Card className="overflow-hidden">
        <div className={`bg-gradient-to-b ${config.bg} p-8 text-center border-b`}>
          <div className="flex justify-center mb-4">{config.icon}</div>
          <h1 className="text-2xl font-bold mb-2">{config.title}</h1>
          <p className="text-gray-500">{config.subtitle}</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Badge variant={config.badgeVariant}>{config.badgeLabel}</Badge>
            <span className="text-sm text-gray-400 font-mono">
              Pedido #{order.number}
            </span>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Transfer info */}
          {isTransfer && status === "pending" && (
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-5">
              <h3 className="font-semibold text-blue-800 mb-3">Datos para la transferencia</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Alias", value: "TQ.DEPORTES.MP" },
                  { label: "CBU/CVU", value: "0000000000000000000000" },
                  { label: "Banco", value: "Mercado Pago" },
                  { label: "Monto exacto", value: formatPrice(Number(order.total)) },
                  { label: "Referencia", value: `Pedido #${order.number}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-blue-600 font-medium">{label}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-blue-900">{value}</span>
                      <button
                        onClick={() => navigator?.clipboard?.writeText(value)}
                        className="p-1 rounded hover:bg-blue-100"
                        title="Copiar"
                      >
                        <Copy className="h-3.5 w-3.5 text-blue-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-600 mt-3">
                Enviá el comprobante a{" "}
                <a href="mailto:info@tqdeportes.com" className="underline">
                  info@tqdeportes.com
                </a>{" "}
                con el número de pedido.
              </p>
            </div>
          )}

          {/* Order items */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              Productos ({order.items.length})
            </h3>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3">
                  <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                    {item.variant.product.images[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.variant.product.images[0].url}
                        alt={item.variant.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "👕"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">
                      {item.variant.product.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {[item.variant.color, item.variant.size].filter(Boolean).join(" / ")}
                      {" · "}x{item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">
                    {formatPrice(Number(item.subtotal))}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatPrice(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Envío</span>
              <span>
                {Number(order.shipping) === 0 ? (
                  <span className="text-green-600 font-medium">GRATIS</span>
                ) : (
                  formatPrice(Number(order.shipping))
                )}
              </span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Total</span>
              <span className="text-blue-600">{formatPrice(Number(order.total))}</span>
            </div>
          </div>

          {/* Shipping info */}
          {order.shippingAddr && (
            <div className="flex gap-3 text-sm text-gray-600">
              <Truck className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{order.shippingName}</p>
                <p className="text-gray-400">
                  {order.shippingAddr}, {order.shippingCity}, {order.shippingProv}{" "}
                  ({order.shippingCp})
                </p>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {status === "failure" ? (
              <>
                <Button className="flex-1" onClick={() => window.history.back()}>
                  Reintentar pago
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/catalogo">Ver catálogo</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/">Volver al inicio</Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href="/catalogo">
                    Seguir comprando <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Follow-up message */}
      {status !== "failure" && (
        <p className="text-center text-sm text-gray-400 mt-6">
          Te enviamos la confirmación a{" "}
          <span className="font-medium text-gray-600">
            {order.guestEmail ?? "tu email registrado"}
          </span>
        </p>
      )}
    </div>
  );
}
