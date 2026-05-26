"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoiceCancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("¿Confirmar anulación? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    await fetch(`/api/admin/facturacion/${id}`, { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCancel}
      disabled={loading}
      className="text-red-600 border-red-200 hover:bg-red-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
      Anular
    </Button>
  );
}
