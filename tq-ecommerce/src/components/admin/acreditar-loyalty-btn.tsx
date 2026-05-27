"use client";

import { useState } from "react";
import { Trophy, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export function AcreditarLoyaltyBtn({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const router = useRouter();

  const acreditar = async () => {
    setState("loading");
    const res = await fetch("/api/admin/loyalty/acreditar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    if (res.ok) {
      setState("done");
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error al acreditar");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <Check className="h-3.5 w-3.5" /> Acreditado
      </span>
    );
  }

  return (
    <button
      onClick={acreditar}
      disabled={state === "loading"}
      className="flex items-center gap-1 text-xs text-[#F5C200] bg-[#3A3A3A] hover:bg-[#2a2a2a] px-2.5 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors"
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trophy className="h-3.5 w-3.5" />
      )}
      Try Club
    </button>
  );
}
