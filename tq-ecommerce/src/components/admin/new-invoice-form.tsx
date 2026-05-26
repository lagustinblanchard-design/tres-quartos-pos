"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

const schema = z.object({
  type: z.enum(["FACTURA_A", "FACTURA_B", "REMITO", "NOTA_CREDITO", "NOTA_DEBITO", "TICKET"]),
  series: z.string().min(1),
  orderId: z.string().optional(),
  clientName: z.string().min(1, "Nombre requerido"),
  clientDni: z.string().optional(),
  clientCuit: z.string().optional(),
  clientEmail: z.string().optional(),
  clientAddr: z.string().optional(),
  subtotal: z.number().min(0),
  iva: z.number().min(0),
  total: z.number().min(0.01, "Total requerido"),
});
type FormData = z.infer<typeof schema>;

type OrderOption = {
  id: string;
  number: number;
  clientName: string;
  total: number;
  createdAt: string;
  hasInvoice: boolean;
};

type OrderData = {
  id: string;
  number: number;
  clientName: string;
  clientEmail: string | null;
  total: number;
  subtotal: number;
  userId: string | null;
  user: { email: string; name: string | null } | null;
  items: { name: string; variant: string; quantity: number; unitPrice: number; subtotal: number }[];
} | null;

const TYPE_LABELS: Record<string, string> = {
  FACTURA_A: "Factura A (responsable inscripto, con IVA discriminado)",
  FACTURA_B: "Factura B (consumidor final, IVA incluido)",
  TICKET: "Ticket",
  REMITO: "Remito",
  NOTA_CREDITO: "Nota de Crédito",
  NOTA_DEBITO: "Nota de Débito",
};

export function NewInvoiceForm({
  orderData,
  recentOrders,
}: {
  orderData: OrderData;
  recentOrders: OrderOption[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "FACTURA_B",
      series: "0001",
      orderId: orderData?.id ?? "",
      clientName: orderData?.clientName ?? "",
      clientEmail: orderData?.clientEmail ?? "",
      subtotal: orderData?.subtotal ?? 0,
      iva: 0,
      total: orderData?.total ?? 0,
    },
  });

  const type = watch("type");
  const subtotal = watch("subtotal");

  // Recalculate IVA when type or subtotal changes
  useEffect(() => {
    if (type === "FACTURA_A") {
      const iva = Math.round(Number(subtotal) * 0.21 * 100) / 100;
      setValue("iva", iva);
      setValue("total", Math.round((Number(subtotal) + iva) * 100) / 100);
    } else {
      setValue("iva", 0);
      setValue("total", Number(subtotal));
    }
  }, [type, subtotal, setValue]);

  // Pre-fill from selected order
  function handleOrderSelect(orderId: string) {
    const order = recentOrders.find((o) => o.id === orderId);
    if (!order) return;
    setValue("orderId", orderId);
    setValue("clientName", order.clientName);
    setValue("subtotal", order.total);
  }

  async function onSubmit(data: FormData) {
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/admin/facturacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, orderId: data.orderId || undefined }),
    });

    if (!res.ok) {
      const body = await res.json();
      const first = Object.values(body.error ?? {})[0];
      setErrorMsg(Array.isArray(first) ? first[0] : (body.error ?? "Error al emitir"));
      setStatus("error");
      return;
    }

    const created = await res.json();
    setStatus("success");
    setTimeout(() => router.push(`/admin/facturacion/${created.id}`), 600);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {status === "success" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Comprobante emitido. Redirigiendo...
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Type + series */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold">Tipo de comprobante</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Tipo *</label>
            <select {...register("type")} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Punto de venta</label>
            <Input {...register("series")} placeholder="0001" />
          </div>
        </div>
      </section>

      {/* Link to order */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold">Pedido asociado <span className="text-sm font-normal text-gray-400">(opcional)</span></h2>
        {recentOrders.length > 0 ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Seleccionar pedido</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              defaultValue={orderData?.id ?? ""}
              onChange={(e) => handleOrderSelect(e.target.value)}
            >
              <option value="">Sin pedido asociado</option>
              {recentOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.number} — {o.clientName} — ${o.total.toLocaleString("es-AR")} {o.hasInvoice ? "(ya facturado)" : ""}
                </option>
              ))}
            </select>
            <input type="hidden" {...register("orderId")} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay pedidos pagados recientes</p>
        )}
      </section>

      {/* Client info */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold">Datos del receptor</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Nombre / Razón social *</label>
            <Input {...register("clientName")} placeholder="Consumidor Final" />
            {errors.clientName && <p className="text-xs text-red-500">{errors.clientName.message}</p>}
          </div>
          {type === "FACTURA_A" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">CUIT *</label>
              <Input {...register("clientCuit")} placeholder="30-12345678-9" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">DNI</label>
              <Input {...register("clientDni")} placeholder="12345678" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input {...register("clientEmail")} type="email" placeholder="cliente@email.com" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Dirección</label>
            <Input {...register("clientAddr")} placeholder="Av. Corrientes 1234, CABA" />
          </div>
        </div>
      </section>

      {/* Amounts */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold">Importes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{type === "FACTURA_A" ? "Neto gravado" : "Subtotal"} *</label>
            <Input {...register("subtotal", { valueAsNumber: true })} type="number" min="0" step="0.01" />
            {errors.subtotal && <p className="text-xs text-red-500">{errors.subtotal.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">IVA 21%</label>
            <Input {...register("iva", { valueAsNumber: true })} type="number" min="0" step="0.01" readOnly={type !== "FACTURA_A"} className={type !== "FACTURA_A" ? "bg-gray-50 text-gray-400" : ""} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Total *</label>
            <Input {...register("total", { valueAsNumber: true })} type="number" min="0" step="0.01" className="font-bold" />
            {errors.total && <p className="text-xs text-red-500">{errors.total.message}</p>}
          </div>
        </div>
        {type === "FACTURA_A" && (
          <p className="text-xs text-gray-400">El IVA se calcula automáticamente (21%). Podés ajustarlo manualmente.</p>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={status === "loading" || status === "success"}>
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Emitir comprobante
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push("/admin/facturacion")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
