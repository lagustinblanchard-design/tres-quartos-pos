"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  Smartphone, Receipt, X, ShoppingBag, Loader2,
  CheckCircle2, AlertCircle, Power, PowerOff,
} from "lucide-react";

type PosSession = {
  id: string;
  openingCash: number;
  openedAt: string;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalMp: number;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  variant: string;
  price: number;
  stock: number;
};

type CartItem = Product & { quantity: number };

type PaymentMethod = "EFECTIVO" | "TARJETA_DEBITO" | "TARJETA_CREDITO" | "TRANSFERENCIA" | "MERCADOPAGO_QR";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

const PAY_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: "EFECTIVO", label: "Efectivo", icon: <Banknote className="h-4 w-4" /> },
  { id: "TARJETA_DEBITO", label: "Débito", icon: <CreditCard className="h-4 w-4" /> },
  { id: "TARJETA_CREDITO", label: "Crédito", icon: <CreditCard className="h-4 w-4" /> },
  { id: "TRANSFERENCIA", label: "Transfer.", icon: <Smartphone className="h-4 w-4" /> },
  { id: "MERCADOPAGO_QR", label: "MP QR", icon: <Smartphone className="h-4 w-4" /> },
];

// ─── Open Session Modal ────────────────────────────────────────────────────────
function OpenSessionModal({ onOpen }: { onOpen: (session: PosSession) => void }) {
  const [cash, setCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOpen() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/pos/sesion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingCash: Number(cash) || 0 }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Error al abrir sesión"); return; }
    onOpen({ ...data, openingCash: Number(data.openingCash), totalSales: 0, totalCash: 0, totalCard: 0, totalTransfer: 0, totalMp: 0 });
  }

  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Power className="h-5 w-5 text-green-600" /> Abrir caja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Efectivo inicial en caja</label>
            <Input
              type="number"
              min="0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
          <Button className="w-full" onClick={handleOpen} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Abrir caja
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Close Session Modal ───────────────────────────────────────────────────────
function CloseSessionModal({
  session,
  onClose,
  onCancel,
}: {
  session: PosSession;
  onClose: () => void;
  onCancel: () => void;
}) {
  const [cash, setCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClose() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/pos/sesion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, closingCash: Number(cash) || 0 }),
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PowerOff className="h-5 w-5 text-red-500" /> Cerrar caja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Efectivo inicial</span><span className="font-medium">{fmt(session.openingCash)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total ventas</span><span className="font-semibold text-blue-600">{fmt(session.totalSales)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>· Efectivo</span><span>{fmt(session.totalCash)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>· Tarjeta</span><span>{fmt(session.totalCard)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>· Transfer.</span><span>{fmt(session.totalTransfer)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>· MP QR</span><span>{fmt(session.totalMp)}</span></div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Efectivo en caja al cierre</label>
            <Input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" autoFocus />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancelar</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleClose} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Cerrar caja
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: { number: number; total: number; items: CartItem[]; paymentMethod: string; cashGiven?: number; change?: number };
  onClose: () => void;
}) {
  const PAY_LABELS: Record<string, string> = { EFECTIVO: "Efectivo", TARJETA_DEBITO: "Débito", TARJETA_CREDITO: "Crédito", TRANSFERENCIA: "Transferencia", MERCADOPAGO_QR: "MP QR" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-80 font-mono text-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <p className="font-bold text-lg">TQ Deportes</p>
          <p className="text-xs text-gray-400">{new Date().toLocaleString("es-AR")}</p>
          <p className="text-xs text-gray-400">Pedido #{receipt.number}</p>
        </div>
        <div className="border-t border-dashed pt-3 mb-3 space-y-1">
          {receipt.items.map((item) => (
            <div key={item.id} className="flex justify-between text-xs">
              <span className="flex-1 truncate pr-2">{item.name} ({item.variant})</span>
              <span className="shrink-0">x{item.quantity} {fmt(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed pt-3 space-y-1">
          <div className="flex justify-between font-bold"><span>TOTAL</span><span>{fmt(receipt.total)}</span></div>
          <div className="flex justify-between text-xs text-gray-500"><span>Método</span><span>{PAY_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</span></div>
          {receipt.cashGiven && receipt.cashGiven > 0 && (
            <div className="flex justify-between text-xs text-gray-500"><span>Entrega</span><span>{fmt(receipt.cashGiven)}</span></div>
          )}
          {receipt.change !== undefined && receipt.change > 0 && (
            <div className="flex justify-between text-xs font-bold text-green-600"><span>Vuelto</span><span>{fmt(receipt.change)}</span></div>
          )}
        </div>
        <div className="text-center mt-4 text-xs text-gray-400">¡Gracias por tu compra!</div>
        <Button className="w-full mt-4" onClick={onClose}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Nueva venta
        </Button>
      </div>
    </div>
  );
}

// ─── Main POS Terminal ─────────────────────────────────────────────────────────
export function POSTerminal({ initialSession }: { initialSession: PosSession | null }) {
  const router = useRouter();
  const [session, setSession] = useState<PosSession | null>(initialSession);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [cashGiven, setCashGiven] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [receipt, setReceipt] = useState<null | { number: number; total: number; items: CartItem[]; paymentMethod: string; cashGiven?: number; change?: number }>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback(async (q: string) => {
    setLoadingProducts(true);
    const res = await fetch(`/api/admin/pos/productos?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoadingProducts(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchProducts("");
  }, [session, fetchProducts]);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(val), 300);
  }

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) {
        if (existing.quantity >= p.stock) return prev;
        return prev.map((i) => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...p, quantity: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, quantity: Math.max(0, Math.min(i.stock, i.quantity + delta)) } : i)
        .filter((i) => i.quantity > 0)
    );
  }

  const subtotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;
  const change = paymentMethod === "EFECTIVO" && cashGiven ? Math.max(0, Number(cashGiven) - total) : 0;

  async function handleCheckout() {
    if (!session || cart.length === 0) return;
    setCheckoutLoading(true);
    setCheckoutError("");

    const res = await fetch("/api/admin/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        items: cart.map((i) => ({ variantId: i.id, quantity: i.quantity, unitPrice: i.price })),
        paymentMethod,
        discount,
        cashGiven: cashGiven ? Number(cashGiven) : undefined,
      }),
    });

    const data = await res.json();
    setCheckoutLoading(false);

    if (!res.ok) {
      setCheckoutError(Array.isArray(data.error) ? data.error.join(", ") : (data.error ?? "Error al procesar la venta"));
      return;
    }

    // Update session totals locally
    setSession((prev) => prev ? { ...prev, totalSales: prev.totalSales + total } : prev);

    setReceipt({
      number: data.number,
      total: data.total,
      items: [...cart],
      paymentMethod,
      cashGiven: cashGiven ? Number(cashGiven) : undefined,
      change,
    });

    // Reset
    setCart([]);
    setDiscount(0);
    setCashGiven("");
    fetchProducts(search);
    searchRef.current?.focus();
  }

  function handleReceiptClose() {
    setReceipt(null);
    router.refresh();
  }

  if (!session) {
    return <OpenSessionModal onOpen={setSession} />;
  }

  return (
    <div className="flex h-full gap-4" style={{ height: "calc(100vh - 3rem)" }}>
      {/* ── Products panel ── */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="flex-1 text-sm outline-none"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoFocus
            />
            {loadingProducts && <Loader2 className="h-4 w-4 animate-spin text-gray-300 shrink-0" />}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
            onClick={() => setShowCloseModal(true)}
          >
            <PowerOff className="h-4 w-4 mr-1" /> Cerrar caja
          </Button>
        </div>

        {/* Session summary strip */}
        <div className="flex gap-3 text-xs">
          <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 font-medium">
            Caja abierta · {new Date(session.openedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 font-medium">
            Ventas: {fmt(session.totalSales)}
          </span>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 content-start">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock === 0}
              className="text-left rounded-lg border bg-white p-3 hover:border-blue-500 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm leading-tight line-clamp-1">{p.name}</p>
                <p className="text-xs text-gray-500">{p.variant}</p>
                <p className="text-xs font-mono text-gray-400">{p.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-blue-600 text-sm">{fmt(p.price)}</span>
                  <span className={`text-xs ${p.stock <= 2 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                    Stock: {p.stock}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {!loadingProducts && products.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
              <ShoppingBag className="h-12 w-12 mb-3" />
              <p className="text-sm">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Cart panel ── */}
      <div className="w-80 xl:w-96 flex flex-col gap-3">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Carrito ({cart.length})</span>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-red-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
                <ShoppingBag className="h-8 w-8 mb-2" />
                Carrito vacío
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <div key={item.id} className="p-3 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.variant}</p>
                      <p className="text-sm font-bold text-blue-600 mt-1">{fmt(item.price)}</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.id, -1)} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-gray-100">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} disabled={item.quantity >= item.stock} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-gray-100 disabled:opacity-40">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button onClick={() => setCart((p) => p.filter((i) => i.id !== item.id))} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals + payment */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 shrink-0">Descuento %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={discount || ""}
                onChange={(e) => setDiscount(Math.min(100, Number(e.target.value)))}
                className="h-8 text-sm"
                placeholder="0"
              />
            </div>

            <div className="space-y-1 text-sm border-t pt-3">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento ({discount}%)</span>
                  <span>-{fmt(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-1">
                <span>Total</span>
                <span className="text-blue-600">{fmt(total)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-5 gap-1">
              {PAY_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors ${
                    paymentMethod === m.id ? "border-blue-500 bg-blue-50 text-blue-600" : "hover:bg-gray-50"
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === "EFECTIVO" && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 shrink-0">Entrega</label>
                <Input
                  type="number"
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  className="h-8 text-sm"
                  placeholder={String(Math.ceil(total / 100) * 100)}
                />
                {change > 0 && (
                  <span className="text-sm font-bold text-green-600 shrink-0">
                    {fmt(change)}
                  </span>
                )}
              </div>
            )}

            {checkoutError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {checkoutError}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0 || checkoutLoading}
              onClick={handleCheckout}
            >
              {checkoutLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Receipt className="h-4 w-4 mr-2" />}
              Cobrar {cart.length > 0 && fmt(total)}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {showCloseModal && session && (
        <CloseSessionModal
          session={session}
          onClose={() => { setSession(null); setShowCloseModal(false); router.refresh(); }}
          onCancel={() => setShowCloseModal(false)}
        />
      )}
      {receipt && <ReceiptModal receipt={receipt} onClose={handleReceiptClose} />}
    </div>
  );
}
