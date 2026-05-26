"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, ChevronRight, Package, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Order = {
  id: string;
  number: number;
  channel: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  itemCount: number;
  customerName: string;
  customerEmail: string;
  shippingName: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparación",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
  DEVUELTO: "Devuelto",
};

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  CONFIRMADO: "bg-blue-100 text-blue-800",
  EN_PREPARACION: "bg-indigo-100 text-indigo-800",
  DESPACHADO: "bg-purple-100 text-purple-800",
  ENTREGADO: "bg-green-100 text-green-800",
  CANCELADO: "bg-gray-100 text-gray-600",
  DEVUELTO: "bg-red-100 text-red-700",
};

const PAY_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "text-amber-600",
  PAGADO: "text-green-600",
  FALLIDO: "text-red-600",
  REEMBOLSADO: "text-gray-500",
};

const PAY_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PAGADO: "Pagado",
  FALLIDO: "Fallido",
  REEMBOLSADO: "Reembolsado",
};

const PAY_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA_DEBITO: "Débito",
  TARJETA_CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  MERCADOPAGO: "MercadoPago",
  MERCADOPAGO_QR: "MP QR",
  CUENTA_CORRIENTE: "Cta. Cte.",
};

const TABS = [
  { key: "TODOS", label: "Todos" },
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "CONFIRMADO", label: "Confirmados" },
  { key: "EN_PREPARACION", label: "En prep." },
  { key: "DESPACHADO", label: "Despachados" },
  { key: "ENTREGADO", label: "Entregados" },
  { key: "CANCELADO", label: "Cancelados" },
];

export function OrdersTable({
  orders,
  countMap,
}: {
  orders: Order[];
  countMap: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const activeTab = searchParams.get("status") ?? "TODOS";

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    router.push(`${pathname}?${sp.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: search });
  }

  const totalAll = Object.values(countMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente o email..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>

        <select
          className="rounded-md border text-sm px-3 py-2 bg-white"
          value={searchParams.get("channel") ?? "TODOS"}
          onChange={(e) => navigate({ channel: e.target.value === "TODOS" ? "" : e.target.value })}
        >
          <option value="TODOS">Todos los canales</option>
          <option value="ONLINE">Online</option>
          <option value="POS">POS</option>
        </select>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap border-b">
        {TABS.map((tab) => {
          const count = tab.key === "TODOS" ? totalAll : (countMap[tab.key] ?? 0);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => navigate({ status: tab.key === "TODOS" ? "" : tab.key })}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${isActive ? "bg-blue-100" : "bg-gray-100"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay pedidos que coincidan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Pedido</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Canal</th>
                  <th className="px-4 py-3 text-left">Pago</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      #{order.number}
                      <span className="block text-xs text-gray-400">{order.itemCount} artículo{order.itemCount !== 1 ? "s" : ""}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="truncate font-medium">{order.customerName}</p>
                      <p className="truncate text-xs text-gray-400">{order.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        {order.channel === "POS"
                          ? <><Monitor className="h-3.5 w-3.5" /> POS</>
                          : <><Package className="h-3.5 w-3.5" /> Online</>
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs">{PAY_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
                      <p className={`text-xs font-medium ${PAY_STATUS_COLORS[order.paymentStatus]}`}>
                        {PAY_LABELS[order.paymentStatus] ?? order.paymentStatus}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ${order.total.toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                      >
                        Ver <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
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
