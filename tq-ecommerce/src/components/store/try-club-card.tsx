"use client";

import { useState } from "react";
import { Trophy, Copy, Check, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

type Coupon = {
  id: string;
  code: string;
  discountPct: number;
  milestone: number;
  expiresAt: Date | string;
};

type LoyaltyStatus = {
  qualifyingCount: number;
  nextMilestone: { count: number; discount: number };
  progressPct: number;
  availableCoupons: Coupon[];
  minPurchase: number;
};

export function TryClubCard({ loyalty }: { loyalty: LoyaltyStatus }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const { qualifyingCount, nextMilestone, progressPct, availableCoupons, minPurchase } = loyalty;
  const remaining = nextMilestone.count - qualifyingCount;

  return (
    <div className="rounded-xl border-2 border-[#F5C200] bg-[#3A3A3A] text-white p-6 mb-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-[#F5C200] flex items-center justify-center shrink-0">
          <Trophy className="h-5 w-5 text-[#3A3A3A]" />
        </div>
        <div>
          <p className="font-barlow font-bold text-[#F5C200] uppercase tracking-widest text-xs">Programa de fidelidad</p>
          <p className="font-barlow font-bold text-xl uppercase leading-tight">Try Club</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm text-gray-300">
            <span className="text-white font-bold text-lg">{qualifyingCount}</span> compras realizadas
          </span>
          <span className="text-xs text-[#F5C200] font-semibold">
            Meta: {nextMilestone.count} → {nextMilestone.discount}% OFF
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#F5C200] transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {remaining === 0
            ? "¡Desbloqueaste tu descuento!"
            : `Te ${remaining === 1 ? "falta 1 compra" : `faltan ${remaining} compras`} para tu próximo try 🏉`}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Mínimo ${minPurchase.toLocaleString("es-AR")} por compra para que cuente
        </p>
      </div>

      {/* Milestones visual */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { count: 3, discount: 15 },
          { count: 5, discount: 25 },
          { count: 10, discount: 50 },
          { count: 20, discount: 60 },
        ].map((m) => {
          const achieved = qualifyingCount >= m.count;
          return (
            <div
              key={m.count}
              className={`rounded-lg p-2.5 text-center border transition-all ${
                achieved
                  ? "border-[#F5C200] bg-[#F5C200]/15"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <p className={`font-barlow font-bold text-lg leading-none ${achieved ? "text-[#F5C200]" : "text-gray-500"}`}>
                {m.count}
              </p>
              <p className={`text-xs mt-0.5 ${achieved ? "text-white" : "text-gray-600"}`}>
                {m.discount}% OFF
              </p>
              {achieved && <div className="mt-1 h-0.5 w-4 bg-[#F5C200] mx-auto rounded" />}
            </div>
          );
        })}
      </div>

      {/* Available coupons */}
      {availableCoupons.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <p className="text-xs font-semibold text-[#F5C200] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Cupones disponibles
          </p>
          <div className="flex flex-col gap-2">
            {availableCoupons.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-2.5"
              >
                <div>
                  <span className="font-mono font-bold text-[#F5C200] tracking-widest">{c.code}</span>
                  <span className="ml-2 text-sm text-white font-semibold">{c.discountPct}% OFF</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Vence {new Date(c.expiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#F5C200] hover:bg-[#F5C200]/20 shrink-0"
                  onClick={() => copy(c.code)}
                >
                  {copiedCode === c.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Usá el código al finalizar tu próxima compra
          </p>
        </div>
      )}
    </div>
  );
}
