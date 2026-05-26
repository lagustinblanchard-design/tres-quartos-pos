"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

type UserData = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
};

export function ProfileForm({ user }: { user: UserData }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name ?? "",
      phone: user.phone ?? "",
      address: user.address ?? "",
      city: user.city ?? "",
      province: user.province ?? "",
      postalCode: user.postalCode ?? "",
    },
  });

  async function onSubmit(data: FormData) {
    setStatus("loading");
    const res = await fetch("/api/cuenta/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setStatus(res.ok ? "success" : "error");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {status === "success" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Datos actualizados correctamente
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> Error al guardar. Intentá de nuevo.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre completo</label>
          <Input {...register("name")} />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-500">Email</label>
          <Input value={user.email} disabled className="bg-gray-50 text-gray-400" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Teléfono</label>
          <Input {...register("phone")} type="tel" placeholder="+54 11 1234-5678" />
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Dirección de envío</p>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Dirección</label>
            <Input {...register("address")} placeholder="Av. Corrientes 1234, Piso 3 Dpto A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ciudad</label>
              <Input {...register("city")} placeholder="Buenos Aires" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Código postal</label>
              <Input {...register("postalCode")} placeholder="1043" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Provincia</label>
            <Input {...register("province")} placeholder="Buenos Aires" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={status === "loading"} className="w-full">
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Guardar cambios
      </Button>
    </form>
  );
}
