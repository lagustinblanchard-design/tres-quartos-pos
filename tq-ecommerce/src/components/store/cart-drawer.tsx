"use client";

import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { X, Minus, Plus, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function CartDrawer() {
  const { items, totalItems, totalPrice, isOpen, closeCart, removeItem, updateQty } = useCart();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold">
            Carrito <span className="text-gray-400 font-normal text-sm">({totalItems})</span>
          </h2>
          <button
            onClick={closeCart}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <ShoppingBag className="h-14 w-14 opacity-30" />
              <div className="text-center">
                <p className="font-medium">Tu carrito está vacío</p>
                <p className="text-sm mt-1">Agregá productos para continuar</p>
              </div>
              <Button variant="outline" onClick={closeCart} asChild>
                <Link href="/catalogo">Ver catálogo</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3">
                  {/* Image */}
                  <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    {item.image ? (
                      <Image src={item.image} alt={item.productName} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">👕</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/catalogo/${item.productSlug}`}
                      onClick={closeCart}
                      className="text-sm font-medium leading-tight hover:text-blue-600 line-clamp-2"
                    >
                      {item.productName}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[item.color, item.size].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-sm font-bold text-blue-600 mt-1">
                      {formatPrice(item.price * item.quantity)}
                    </p>

                    {/* Qty controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQty(item.variantId, item.quantity - 1)}
                        className="h-6 w-6 flex items-center justify-center rounded border hover:bg-gray-100 transition-colors disabled:opacity-40"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.variantId, item.quantity + 1)}
                        className="h-6 w-6 flex items-center justify-center rounded border hover:bg-gray-100 transition-colors disabled:opacity-40"
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-5 py-5 space-y-4">
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold">{formatPrice(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Envío</span>
              <span>{totalPrice >= 50000 ? "GRATIS" : "Calculado al hacer el pedido"}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-3">
              <span>Total</span>
              <span className="text-blue-600">{formatPrice(totalPrice)}</span>
            </div>

            <Button size="lg" className="w-full" asChild onClick={closeCart}>
              <Link href="/checkout">
                Ir al checkout <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <button
              onClick={closeCart}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Seguir comprando
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
