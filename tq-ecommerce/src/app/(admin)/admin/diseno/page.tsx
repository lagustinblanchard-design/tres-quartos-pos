import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Palette } from "lucide-react";
import { DisenoForm, type HeroConfig, type Banner, type CtaConfig } from "@/components/admin/diseno-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diseño — Admin" };

export default async function DisenoPage() {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") redirect("/admin");

  const configs = await prisma.businessConfig.findMany({
    where: { key: { in: ["homepage_hero", "homepage_banners", "homepage_cta"] } },
  });
  const map = Object.fromEntries(configs.map((c) => [c.key, JSON.parse(c.value)]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Palette className="h-6 w-6 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold">Diseño de la tienda</h1>
          <p className="text-sm text-gray-500">Editá el contenido visible en la página de inicio.</p>
        </div>
      </div>
      <DisenoForm
        initial={{
          homepage_hero: map.homepage_hero as HeroConfig | undefined,
          homepage_banners: map.homepage_banners as Banner[] | undefined,
          homepage_cta: map.homepage_cta as CtaConfig | undefined,
        }}
      />
    </div>
  );
}
