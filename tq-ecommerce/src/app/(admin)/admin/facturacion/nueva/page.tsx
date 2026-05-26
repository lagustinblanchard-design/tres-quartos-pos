import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NewInvoiceForm } from "@/components/admin/new-invoice-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo comprobante — Admin" };

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  // Pre-fill from order if orderId param is provided
  let orderData: {
    id: string;
    number: number;
    clientName: string;
    clientEmail: string | null;
    total: number;
    subtotal: number;
    userId: string | null;
    user: { email: string; name: string | null } | null;
    items: { name: string; variant: string; quantity: number; unitPrice: number; subtotal: number }[];
  } | null = null;

  if (searchParams.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: searchParams.orderId },
      include: {
        user: { select: { name: true, email: true, cuit: true, dni: true, address: true } },
        items: {
          include: {
            variant: { include: { product: { select: { name: true } } } },
          },
        },
      },
    });
    if (order) {
      orderData = {
        id: order.id,
        number: order.number,
        clientName: order.user?.name ?? order.shippingName ?? order.guestName ?? "Consumidor Final",
        clientEmail: order.user?.email ?? order.guestEmail ?? null,
        total: Number(order.total),
        subtotal: Number(order.subtotal),
        userId: order.userId,
        user: order.user ? { email: order.user.email, name: order.user.name } : null,
        items: order.items.map((i) => ({
          name: i.variant.product.name,
          variant: [i.variant.color, i.variant.size ? `T.${i.variant.size}` : null].filter(Boolean).join(" "),
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          subtotal: Number(i.subtotal),
        })),
      };
    }
  }

  // Recent orders for quick selection
  const recentOrders = await prisma.order.findMany({
    where: { channel: "ONLINE", paymentStatus: "PAGADO" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      number: true,
      shippingName: true,
      guestName: true,
      total: true,
      createdAt: true,
      user: { select: { name: true } },
      invoices: { select: { id: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <Link href="/admin/facturacion" className="hover:text-gray-600">Facturación</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-700 font-medium">Nuevo comprobante</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo comprobante</h1>
      <NewInvoiceForm
        orderData={orderData}
        recentOrders={recentOrders.map((o) => ({
          id: o.id,
          number: o.number,
          clientName: o.user?.name ?? o.shippingName ?? o.guestName ?? "—",
          total: Number(o.total),
          createdAt: o.createdAt.toISOString(),
          hasInvoice: o.invoices.length > 0,
        }))}
      />
    </div>
  );
}
