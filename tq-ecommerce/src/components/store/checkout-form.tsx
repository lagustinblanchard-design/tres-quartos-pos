"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Truck,
  CreditCard,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Banknote,
} from "lucide-react";

const shippingSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(8, "Teléfono inválido"),
  address: z.string().min(5, "Dirección requerida"),
  city: z.string().min(2, "Ciudad requerida"),
  province: z.string().min(2, "Provincia requerida"),
  postalCode: z.string().min(4, "Código postal inválido"),
});

type ShippingData = z.infer<typeof shippingSchema>;

type PaymentMethod = "MERCADOPAGO" | "TRANSFERENCIA";

const PROVINCES = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

export function CheckoutForm() {
  const { items, totalPrice, clearCart } = useCart();
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("MERCADOPAGO");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string[]>([]);

  const shippingCost = totalPrice >= 50000 ? 0 : 2500;
  const total = totalPrice + shippingCost;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShippingData>({ resolver: zodResolver(shippingSchema) });

  async function onSubmit(shipping: ShippingData) {
    if (items.length === 0) return;
    setLoading(true);
    setApiError([]);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          shipping,
          paymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) setApiError(data.details);
        else setApiError([data.error ?? "Error al procesar el pedido"]);
        return;
      }

      clearCart();

      if (paymentMethod === "MERCADOPAGO") {
        // Redirigir al Checkout Pro de MercadoPago
        const mpUrl = process.env.NODE_ENV === "production"
          ? data.initPoint
          : data.sandboxInitPoint;
        window.location.href = mpUrl;
      } else {
        // Transferencia: ir directo a confirmación
        router.push(`/checkout/confirmacion/${data.orderId}?status=pending&method=transferencia`);
      }
    } catch {
      setApiError(["Error de conexión. Intentá de nuevo."]);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg font-medium">Tu carrito está vacío</p>
        <Button className="mt-4" onClick={() => router.push("/catalogo")}>
          Ver catálogo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── LEFT: Shipping + Payment ─────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Shipping */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Datos de envío
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nombre completo *</label>
                  <Input {...register("name")} placeholder="Juan Pérez" />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email *</label>
                  <Input {...register("email")} type="email" placeholder="juan@email.com" />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teléfono *</label>
                <Input {...register("phone")} placeholder="+54 9 11 1234-5678" />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Dirección *</label>
                <Input {...register("address")} placeholder="Av. Corrientes 1234, Piso 3, Depto B" />
                {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium">Código postal *</label>
                  <Input {...register("postalCode")} placeholder="1234" />
                  {errors.postalCode && <p className="text-xs text-red-500">{errors.postalCode.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ciudad *</label>
                  <Input {...register("city")} placeholder="Buenos Aires" />
                  {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Provincia *</label>
                  <select
                    {...register("province")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Seleccioná</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  {errors.province && <p className="text-xs text-red-500">{errors.province.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Método de pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* MercadoPago */}
              <button
                type="button"
                onClick={() => setPaymentMethod("MERCADOPAGO")}
                className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  paymentMethod === "MERCADOPAGO"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="h-10 w-10 rounded-lg bg-[#009EE3] flex items-center justify-center shrink-0">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">MercadoPago</p>
                  <p className="text-xs text-gray-500">
                    Tarjeta de débito, crédito, Mercado Crédito, QR y más
                  </p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === "MERCADOPAGO" ? "border-blue-500 bg-blue-500" : "border-gray-300"
                }`}>
                  {paymentMethod === "MERCADOPAGO" && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
              </button>

              {/* Transferencia */}
              <button
                type="button"
                onClick={() => setPaymentMethod("TRANSFERENCIA")}
                className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  paymentMethod === "TRANSFERENCIA"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Banknote className="h-5 w-5 text-green-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Transferencia bancaria</p>
                  <p className="text-xs text-gray-500">
                    Te enviamos los datos al email. Acreditación en 24-48hs.
                  </p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === "TRANSFERENCIA" ? "border-blue-500 bg-blue-500" : "border-gray-300"
                }`}>
                  {paymentMethod === "TRANSFERENCIA" && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Order summary ──────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumen del pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <li key={item.variantId} className="flex gap-3">
                      <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.productName}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-2xl">👕</div>
                        )}
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight line-clamp-2">{item.productName}</p>
                        <p className="text-xs text-gray-400">
                          {[item.color, item.size].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="text-sm font-semibold shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>

                {/* Totals */}
                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Envío</span>
                    <span className={shippingCost === 0 ? "text-green-600 font-medium" : ""}>
                      {shippingCost === 0 ? "GRATIS" : formatPrice(shippingCost)}
                    </span>
                  </div>
                  {shippingCost === 0 && (
                    <p className="text-xs text-green-600">
                      ¡Envío gratis por comprar más de $50.000!
                    </p>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span className="text-blue-600">{formatPrice(total)}</span>
                  </div>
                </div>

                {/* API errors */}
                {apiError.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-700">No pudimos procesar el pedido:</p>
                        <ul className="mt-1 space-y-0.5">
                          {apiError.map((e, i) => (
                            <li key={i} className="text-xs text-red-600">• {e}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {paymentMethod === "MERCADOPAGO"
                    ? "Ir a MercadoPago"
                    : "Confirmar pedido"}
                </Button>

                <p className="text-center text-xs text-gray-400">
                  Al confirmar aceptás nuestros{" "}
                  <a href="/terminos" className="underline hover:text-gray-600">
                    términos y condiciones
                  </a>
                </p>
              </CardContent>
            </Card>

            {/* Security badges */}
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">🔒 SSL Seguro</span>
              <span>·</span>
              <span className="flex items-center gap-1">✓ Datos protegidos</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
