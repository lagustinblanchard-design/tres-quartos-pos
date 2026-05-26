import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo producto — Admin" };

export default async function NuevoProductoPage() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <Link href="/admin/productos" className="hover:text-gray-600">Productos</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-700 font-medium">Nuevo producto</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo producto</h1>
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
