"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, PackagePlus, PackageMinus, SlidersHorizontal, Loader2 } from "lucide-react";

type AdjustType = "ENTRADA" | "SALIDA" | "AJUSTE";

type Variant = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stock: number;
  product: { name: string };
};

type Props = {
  variant: Variant;
  onClose: () => void;
  onSuccess: (variantId: string, newStock: number) => void;
};

const TYPES: { id: AdjustType; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  {
    id: "ENTRADA",
    label: "Entrada",
    icon: <PackagePlus className="h-5 w-5" />,
    description: "Sumar unidades al stock actual",
    color: "border-green-500 bg-green-50 text-green-700",
  },
  {
    id: "SALIDA",
    label: "Salida",
    icon: <PackageMinus className="h-5 w-5" />,
    description: "Restar unidades del stock actual",
    color: "border-red-500 bg-red-50 text-red-700",
  },
  {
    id: "AJUSTE",
    label: "Ajuste manual",
    icon: <SlidersHorizontal className="h-5 w-5" />,
    description: "Fijar el stock a un valor exacto",
    color: "border-blue-500 bg-blue-50 text-blue-700",
  },
];

const REASONS: Record<AdjustType, string[]> = {
  ENTRADA: ["Compra a proveedor", "Devolución de cliente", "Transferencia de sucursal", "Corrección de inventario"],
  SALIDA: ["Merma / daño", "Muestra / regalo", "Transferencia de sucursal", "Corrección de inventario"],
  AJUSTE: ["Inventario físico", "Corrección de error", "Otro"],
};

export function StockAdjustModal({ variant, onClose, onSuccess }: Props) {
  const [type, setType] = useState<AdjustType>("ENTRADA");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const qty = parseInt(quantity) || 0;
  const preview =
    type === "ENTRADA"
      ? variant.stock + qty
      : type === "SALIDA"
      ? Math.max(0, variant.stock - qty)
      : qty;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qty || qty <= 0) { setError("Ingresá una cantidad válida"); return; }
    const finalReason = reason === "Otro" ? customReason : reason;
    if (!finalReason) { setError("Seleccioná un motivo"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: variant.id,
          type,
          quantity: qty,
          reason: finalReason,
          reference: reference || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al ajustar el stock");
      }
      const { variant: updated } = await res.json();
      onSuccess(variant.id, updated.stock);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-bold text-lg">Ajustar stock</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {variant.product.name}
              {(variant.color || variant.size) && (
                <span className="text-gray-400">
                  {" — "}{[variant.color, variant.size].filter(Boolean).join(" / ")}
                </span>
              )}
            </p>
            <p className="text-xs font-mono text-gray-400">{variant.sku}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Current stock indicator */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-500">Stock actual</span>
            <span className="text-2xl font-bold">{variant.stock}</span>
          </div>

          {/* Type selector */}
          <div>
            <p className="text-sm font-semibold mb-2">Tipo de movimiento</p>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setType(t.id); setReason(""); setQuantity(""); }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-xs font-medium transition-all ${
                    type === t.id ? t.color : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {TYPES.find((t) => t.id === type)?.description}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              {type === "AJUSTE" ? "Nuevo stock total" : "Cantidad"}
            </label>
            <Input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === "AJUSTE" ? "Ej: 25" : "Ej: 10"}
              className="text-lg font-semibold"
              autoFocus
            />
          </div>

          {/* Preview */}
          {qty > 0 && (
            <div className="flex items-center justify-between rounded-lg border-2 border-dashed px-4 py-3">
              <span className="text-sm text-gray-500">Stock resultante</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-sm">{variant.stock}</span>
                <span className="text-2xl font-bold text-blue-600">{preview}</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Motivo</label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS[type].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-lg border px-3 py-2 text-xs text-left transition-colors ${
                    reason === r
                      ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === "Otro" && (
              <Input
                className="mt-2 text-sm"
                placeholder="Especificá el motivo..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          {/* Reference (optional) */}
          <div>
            <label className="text-sm font-medium text-gray-500 mb-1.5 block">
              Referencia <span className="text-gray-400">(opcional)</span>
            </label>
            <Input
              placeholder="Nro. de factura, remito, OC..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar ajuste
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
