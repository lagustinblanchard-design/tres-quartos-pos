"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderData = {
  id: string;
  number: number;
  status: string;
  trackingCode: string | null;
  notes: string | null;
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

// Valid transitions per status
const NEXT_STATUSES: Record<string, string[]> = {
  PENDIENTE: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["EN_PREPARACION", "CANCELADO"],
  EN_PREPARACION: ["DESPACHADO", "CANCELADO"],
  DESPACHADO: ["ENTREGADO"],
  ENTREGADO: ["DEVUELTO"],
  CANCELADO: [],
  DEVUELTO: [],
};

export function OrderStatusPanel({ order }: { order: OrderData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tracking, setTracking] = useState(order.trackingCode ?? "");
  const [showTracking, setShowTracking] = useState(false);

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];

  async function changeStatus(newStatus: string) {
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/admin/pedidos/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        ...(newStatus === "DESPACHADO" && tracking ? { trackingCode: tracking } : {}),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Error al actualizar el estado");
      return;
    }
    setSuccess(`Estado cambiado a: ${STATUS_LABELS[newStatus]}`);
    setShowTracking(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm p-5">
      <h2 className="font-semibold mb-4">Estado del pedido</h2>

      {/* Current status */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">Estado actual</p>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 mb-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-3">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Tracking input (shown when dispatching) */}
      {showTracking && (
        <div className="mb-3 space-y-1.5">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" /> Código de seguimiento (opcional)
          </label>
          <Input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="OCA-123456"
            className="text-sm"
          />
        </div>
      )}

      {/* Action buttons */}
      {nextStatuses.length > 0 ? (
        <div className="space-y-2">
          {nextStatuses.map((next) => {
            const isCancelAction = next === "CANCELADO";
            const isDispatch = next === "DESPACHADO";
            return (
              <div key={next}>
                {isDispatch && !showTracking ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowTracking(true)}
                    disabled={loading}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Marcar como Despachado
                  </Button>
                ) : isDispatch && showTracking ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => changeStatus(next)}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Confirmar despacho
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowTracking(false)}
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant={isCancelAction ? "outline" : "default"}
                    className={`w-full justify-start ${isCancelAction ? "text-red-600 border-red-200 hover:bg-red-50" : ""}`}
                    onClick={() => changeStatus(next)}
                    disabled={loading}
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {isCancelAction ? "Cancelar pedido" : `Marcar como ${STATUS_LABELS[next]}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No hay acciones disponibles para este estado.</p>
      )}
    </div>
  );
}
