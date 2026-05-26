import { prisma } from "@/lib/prisma";
import { ConfigForm } from "@/components/admin/config-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración — Admin" };

const DEFAULT_CONFIGS: Record<string, { label: string; description: string; defaultValue: string; type: "text" | "number" | "textarea" }> = {
  store_name: { label: "Nombre de la tienda", description: "Nombre que aparece en emails y comprobantes", defaultValue: "TQ Deportes", type: "text" },
  store_email: { label: "Email de contacto", description: "Email de atención al cliente", defaultValue: "", type: "text" },
  store_phone: { label: "Teléfono / WhatsApp", description: "Número visible en la tienda", defaultValue: "", type: "text" },
  store_address: { label: "Dirección física", description: "Dirección del local", defaultValue: "", type: "text" },
  shipping_free_threshold: { label: "Envío gratis desde ($)", description: "Pedidos mayores a este monto tienen envío gratis", defaultValue: "50000", type: "number" },
  shipping_default_cost: { label: "Costo de envío base ($)", description: "Costo cuando no aplica envío gratis", defaultValue: "2500", type: "number" },
  transfer_cbu: { label: "CBU / CVU (transferencia)", description: "CBU o CVU para pagos por transferencia", defaultValue: "", type: "text" },
  transfer_alias: { label: "Alias (transferencia)", description: "Alias de la cuenta bancaria", defaultValue: "", type: "text" },
  transfer_bank: { label: "Banco (transferencia)", description: "Nombre del banco o billetera", defaultValue: "", type: "text" },
  invoice_cuit: { label: "CUIT del emisor", description: "CUIT de la empresa para facturación", defaultValue: "", type: "text" },
  invoice_razon_social: { label: "Razón social", description: "Nombre fiscal para comprobantes", defaultValue: "TQ Deportes", type: "text" },
  invoice_iva_condition: { label: "Condición IVA", description: "Ej: Responsable Inscripto, Monotributista", defaultValue: "Monotributista", type: "text" },
  low_stock_alert_default: { label: "Alerta de stock mínimo (unidades)", description: "Valor por defecto al crear variantes de producto", defaultValue: "5", type: "number" },
};

export default async function ConfiguracionPage() {
  const configs = await prisma.businessConfig.findMany();
  const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));

  const fields = Object.entries(DEFAULT_CONFIGS).map(([key, meta]) => ({
    key,
    ...meta,
    value: configMap[key] ?? meta.defaultValue,
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Parámetros generales de la tienda</p>
      </div>

      <ConfigForm fields={fields} />
    </div>
  );
}
