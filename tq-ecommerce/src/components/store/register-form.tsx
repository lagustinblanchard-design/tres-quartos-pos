"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

const schema = z
  .object({
    name: z.string().min(2, "Nombre requerido (mín. 2 caracteres)"),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Za-z]/, "Debe contener al menos una letra")
      .regex(/[0-9]/, "Debe contener al menos un número"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
    });

    if (!res.ok) {
      const body = await res.json();
      const firstError =
        Object.values(body.error as Record<string, string[]>)[0]?.[0] ??
        "Error al crear la cuenta";
      setError(firstError);
      setLoading(false);
      return;
    }

    // Auto sign-in after registration
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    router.push("/cuenta");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Nombre completo</label>
        <Input
          {...register("name")}
          type="text"
          placeholder="Tu nombre"
          autoComplete="name"
          autoFocus
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Email</label>
        <Input
          {...register("email")}
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Contraseña</label>
        <div className="relative">
          <Input
            {...register("password")}
            type={showPass ? "text" : "password"}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
        <ul className="mt-1 space-y-0.5 text-xs text-gray-400">
          <li className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Mínimo 8 caracteres, una letra y un número
          </li>
        </ul>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Confirmar contraseña</label>
        <Input
          {...register("confirmPassword")}
          type={showPass ? "text" : "password"}
          placeholder="Repetí la contraseña"
          autoComplete="new-password"
          className="pr-10"
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-gray-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-blue-600 font-medium hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </form>
  );
}
