import { Metadata } from "next";
import { CheckoutForm } from "@/components/store/checkout-form";
import { Lock } from "lucide-react";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Finalizar compra</h1>
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <Lock className="h-4 w-4" />
          Pago seguro
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-sm mb-8">
        {["Carrito", "Datos de envío", "Pago"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-gray-200" />}
            <div className={`flex items-center gap-1.5 ${i === 1 ? "font-semibold text-blue-600" : "text-gray-400"}`}>
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 1 ? "bg-blue-600 text-white" : i === 0 ? "bg-gray-200 text-gray-600" : "bg-gray-100 text-gray-400"
              }`}>
                {i + 1}
              </div>
              {step}
            </div>
          </div>
        ))}
      </div>

      <CheckoutForm />
    </div>
  );
}
