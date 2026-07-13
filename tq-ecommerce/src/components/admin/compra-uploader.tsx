"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

interface PlanItem {
  codigo: string;
  nombre: string;
  categoria: string;
  talla: string;
  cantidad: number;
  kind: "matched" | "variante-nueva" | "producto-nuevo" | "codigo-duplicado";
  productId?: string;
  variantId?: string;
  proposedSku?: string;
  costoUnitario?: number;
  precioVenta?: number;
}

interface PreviewResponse {
  items: PlanItem[];
  invalid: { fila: number; codigo: string; nombre: string; motivo: string }[];
  resumen: {
    totalLineas: number;
    matched: number;
    varianteNueva: number;
    productoNuevo: number;
    codigoDuplicado: number;
    filasInvalidas: number;
  };
}

const KIND_LABEL: Record<PlanItem["kind"], { label: string; color: string }> = {
  matched: { label: "Directo", color: "bg-green-100 text-green-700" },
  "variante-nueva": { label: "Talle nuevo", color: "bg-amber-100 text-amber-700" },
  "producto-nuevo": { label: "Producto nuevo", color: "bg-blue-100 text-blue-700" },
  "codigo-duplicado": { label: "Código duplicado — revisar", color: "bg-red-100 text-red-700" },
};

interface Order {
  id: string;
  supplier: string;
  status: string;
  total: number | null;
  itemCount: number;
  totalUnidades: number;
  createdAt: string;
}

export function CompraUploader({ initialOrders }: { initialOrders: Order[] }) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [supplierName, setSupplierName] = useState("IMAGO Indumentarias");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setPreview(null);

    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/compras/preview", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo leer el archivo");
        return;
      }
      setPreview(data);
      setItems(data.items.filter((i: PlanItem) => i.kind !== "codigo-duplicado"));
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function updateItem(idx: number, patch: Partial<PlanItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/compras", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ supplierName, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear la orden");
        return;
      }
      setSuccess(`Orden creada (${items.length} ítems). Confirmá la recepción cuando llegue la mercadería.`);
      setPreview(null);
      setItems([]);
      const listRes = await fetch("/api/admin/compras");
      if (listRes.ok) setOrders(await listRes.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleRecibir(orderId: string) {
    if (!confirm("¿Confirmar la recepción de esta orden? Esto suma el stock y no se puede deshacer desde acá.")) return;
    setReceivingId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/compras/${orderId}/recibir`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo recibir la orden");
        return;
      }
      const listRes = await fetch("/api/admin/compras");
      if (listRes.ok) setOrders(await listRes.json());
    } finally {
      setReceivingId(null);
    }
  }

  const hasDuplicados = preview && preview.resumen.codigoDuplicado > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1">Proveedor</label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-64" />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed px-4 py-2.5 text-sm hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            Subir Cuadro de Pedido (.xls/.xlsx)
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} disabled={loading} />
          </label>
        </div>

        {loading && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</p>}
        {error && <p className="text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {error}</p>}
        {success && <p className="text-sm text-green-600 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {success}</p>}

        {hasDuplicados && (
          <p className="text-sm text-red-600">
            El archivo tiene {preview!.resumen.codigoDuplicado} línea(s) con código duplicado — se excluyeron del pedido.
            Corregí el código en el Excel del proveedor y volvé a subirlo si necesitás esos ítems.
          </p>
        )}

        {preview && items.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-gray-500">
              {preview.resumen.matched} directo(s) · {preview.resumen.varianteNueva} talle(s) nuevo(s) · {preview.resumen.productoNuevo} producto(s) nuevo(s)
              {preview.resumen.filasInvalidas > 0 && ` · ${preview.resumen.filasInvalidas} fila(s) inválida(s)`}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2 pr-3">Talle</th>
                    <th className="py-2 pr-3">Cant.</th>
                    <th className="py-2 pr-3">Estado</th>
                    {items.some((i) => i.kind === "producto-nuevo" || i.kind === "variante-nueva") && (
                      <th className="py-2 pr-3">Precio venta</th>
                    )}
                    <th className="py-2 pr-3">Costo unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={`${item.codigo}-${item.talla}-${idx}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">{item.codigo}</td>
                      <td className="py-2 pr-3">{item.nombre}</td>
                      <td className="py-2 pr-3">{item.talla || "Única"}</td>
                      <td className="py-2 pr-3">{item.cantidad}</td>
                      <td className="py-2 pr-3">
                        <Badge className={KIND_LABEL[item.kind].color}>{KIND_LABEL[item.kind].label}</Badge>
                      </td>
                      {items.some((i) => i.kind === "producto-nuevo" || i.kind === "variante-nueva") && (
                        <td className="py-2 pr-3">
                          {(item.kind === "producto-nuevo" || item.kind === "variante-nueva") && (
                            <Input
                              type="number"
                              className="w-28 h-8"
                              placeholder="$"
                              value={item.precioVenta ?? ""}
                              onChange={(e) => updateItem(idx, { precioVenta: e.target.value ? Number(e.target.value) : undefined })}
                            />
                          )}
                        </td>
                      )}
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          className="w-28 h-8"
                          placeholder="$"
                          value={item.costoUnitario ?? ""}
                          onChange={(e) => updateItem(idx, { costoUnitario: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Confirmar pedido ({items.length} ítems)
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white">
        <div className="p-4 border-b font-medium">Órdenes de compra</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 px-4">Proveedor</th>
              <th className="py-2 px-4">Ítems</th>
              <th className="py-2 px-4">Unidades</th>
              <th className="py-2 px-4">Estado</th>
              <th className="py-2 px-4">Fecha</th>
              <th className="py-2 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="py-2 px-4">{o.supplier}</td>
                <td className="py-2 px-4">{o.itemCount}</td>
                <td className="py-2 px-4">{o.totalUnidades}</td>
                <td className="py-2 px-4">
                  <Badge className={o.status === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}>
                    {o.status}
                  </Badge>
                </td>
                <td className="py-2 px-4">{new Date(o.createdAt).toLocaleDateString("es-AR")}</td>
                <td className="py-2 px-4 text-right">
                  {o.status === "PENDIENTE" && (
                    <Button size="sm" variant="outline" onClick={() => handleRecibir(o.id)} disabled={receivingId === o.id}>
                      {receivingId === o.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Recibir
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  Todavía no hay órdenes de compra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
