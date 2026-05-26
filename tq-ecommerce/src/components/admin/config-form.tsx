"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Field = {
  key: string;
  label: string;
  description: string;
  value: string;
  type: "text" | "number" | "textarea";
};

const SECTIONS = [
  { label: "Tienda", keys: ["store_name", "store_email", "store_phone", "store_address"] },
  { label: "Envíos", keys: ["shipping_free_threshold", "shipping_default_cost"] },
  { label: "Transferencia bancaria", keys: ["transfer_cbu", "transfer_alias", "transfer_bank"] },
  { label: "Facturación", keys: ["invoice_cuit", "invoice_razon_social", "invoice_iva_condition"] },
  { label: "Inventario", keys: ["low_stock_alert_default"] },
];

export function ConfigForm({ fields }: { fields: Field[] }) {
  const fieldMap = Object.fromEntries(fields.map((f) => [f.key, f]));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value]))
  );
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSave() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: values }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setErrorMsg("No se pudo guardar la configuración");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      {status === "success" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Configuración guardada correctamente
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {SECTIONS.map((section) => {
        const sectionFields = section.keys.map((k) => fieldMap[k]).filter(Boolean);
        return (
          <section key={section.label} className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-800 border-b pb-2">{section.label}</h2>
            <div className="space-y-4">
              {sectionFields.map((field) => (
                <div key={field.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                  <div className="sm:col-span-1">
                    <label className="text-sm font-medium text-gray-700">{field.label}</label>
                    <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type={field.type === "number" ? "number" : "text"}
                      value={values[field.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.label}
                      min={field.type === "number" ? 0 : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex gap-3">
        <Button onClick={handleSave} size="lg" disabled={status === "loading"}>
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
