import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/components/store/profile-form";

export const metadata = { title: "Mis datos" };

export default async function PerfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="container mx-auto px-4 py-10 max-w-xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/cuenta" className="text-sm text-gray-400 hover:text-gray-600">
          Mi cuenta
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-300" />
        <span className="text-sm font-medium">Mis datos</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Mis datos</h1>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
