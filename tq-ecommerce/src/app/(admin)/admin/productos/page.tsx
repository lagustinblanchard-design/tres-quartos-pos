import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductsTable } from "@/components/admin/products-table";

export const metadata = { title: "Productos — Admin" };
export const dynamic = "force-dynamic";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string };
}) {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(searchParams.q
          ? {
              OR: [
                { name: { contains: searchParams.q, mode: "insensitive" } },
                { sku: { contains: searchParams.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(searchParams.cat ? { categoryId: searchParams.cat } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: { select: { id: true, stock: true, price: true } },
        images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const serialized = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    category: p.category.name,
    brand: p.brand?.name ?? null,
    variantCount: p.variants.length,
    totalStock: p.variants.reduce((a, v) => a + v.stock, 0),
    minPrice: p.variants.length ? Math.min(...p.variants.map((v) => Number(v.price))) : 0,
    image: p.images[0]?.url ?? null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} productos en total</p>
        </div>
        <Button asChild>
          <Link href="/admin/productos/nuevo">
            <Plus className="h-4 w-4 mr-2" /> Nuevo producto
          </Link>
        </Button>
      </div>
      <ProductsTable products={serialized} categories={categories} />
    </div>
  );
}
