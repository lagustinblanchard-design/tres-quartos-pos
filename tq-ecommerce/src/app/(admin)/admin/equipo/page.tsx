import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { EquipoManager } from "@/components/admin/equipo-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipo" };

export default async function EquipoPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const serialized = admins.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-bold">Equipo</h1>
      </div>
      <p className="text-sm text-gray-500">
        Gestioná quién tiene acceso al panel de administración. Los usuarios deben registrarse primero en la tienda.
      </p>
      <EquipoManager admins={serialized} currentUserId={session.user.id} />
    </div>
  );
}
