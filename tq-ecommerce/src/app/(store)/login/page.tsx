import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/store/login-form";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/cuenta");

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Bienvenido de nuevo</h1>
          <p className="mt-1 text-sm text-gray-500">Ingresá a tu cuenta para continuar</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
