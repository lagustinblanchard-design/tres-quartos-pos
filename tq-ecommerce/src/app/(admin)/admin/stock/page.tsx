import { prisma } from "@/lib/prisma";
import { StockTable } from "@/components/admin/stock-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, PackageX, Package, History } from "lucide-react";

async function getStockSummary() {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    select: { stock: true, stockAlert: true },
  });

  return {
    total: variants.length,
    out: variants.filter((v) => v.stock === 0).length,
    critical: variants.filter((v) => v.stock > 0 && v.stock <= v.stockAlert).length,
    ok: variants.filter((v) => v.stock > v.stockAlert).length,
    totalUnits: variants.reduce((acc, v) => acc + v.stock, 0),
  };
}

async function getInitialVariants() {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          category: { select: { id: true, name: true } },
          brand: { select: { name: true } },
          images: { orderBy: { position: "asc" }, take: 1 },
        },
      },
    },
    orderBy: { stock: "asc" },
    take: 50,
  });

  return variants.map((v) => ({
    ...v,
    price: Number(v.price),
    costPrice: v.costPrice ? Number(v.costPrice) : null,
  }));
}

async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export const metadata = { title: "Stock | Admin" };
export const dynamic = "force-dynamic";

export default async function StockPage() {
  const [summary, initialVariants, categories] = await Promise.all([
    getStockSummary(),
    getInitialVariants(),
    getCategories(),
  ]);

  const statCards = [
    {
      label: "Variantes en stock",
      value: summary.ok,
      sub: `${summary.totalUnits.toLocaleString("es-AR")} unidades totales`,
      icon: Package,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Stock crítico",
      value: summary.critical,
      sub: "Por debajo del umbral de alerta",
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      highlight: summary.critical > 0,
    },
    {
      label: "Sin stock",
      value: summary.out,
      sub: "Variantes sin unidades disponibles",
      icon: PackageX,
      color: "text-red-600",
      bg: "bg-red-50",
      highlight: summary.out > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Stock</h1>
          <p className="text-gray-500 text-sm">{summary.total} variantes activas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/stock/movimientos">
              <History className="h-4 w-4 mr-1.5" />
              Historial
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, sub, icon: Icon, color, bg, highlight }) => (
          <Card key={label} className={highlight ? "ring-2 ring-offset-1 ring-amber-300" : ""}>
            <CardContent className="p-5 flex items-start gap-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-3xl font-bold mt-0.5 ${highlight ? color : ""}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Interactive table (client component) */}
      <StockTable initialVariants={initialVariants} categories={categories} />
    </div>
  );
}
