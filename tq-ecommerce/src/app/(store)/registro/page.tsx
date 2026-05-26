import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/store/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegistroPage() {
  const session = await auth();
  if (session) redirect("/cuenta");

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Creá tu cuenta</h1>
          <p className="mt-1 text-sm text-gray-500">Es gratis y solo toma un minuto</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
