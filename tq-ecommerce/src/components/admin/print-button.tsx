"use client";

import { useEffect } from "react";

export function PrintButton() {
  useEffect(() => {
    // Auto-print after a short delay so styles load
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="no-print" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
      <button
        onClick={() => window.print()}
        style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
      >
        Imprimir / Guardar PDF
      </button>
      <button
        onClick={() => window.close()}
        style={{ padding: "8px 16px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
      >
        Cerrar
      </button>
    </div>
  );
}
