import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar producto — Admin" };

export default async function EditarProductoPage({ params }: { params: { id: string } }) {
  const [product, categories, brands] = await Promise.all([
    prisma.product.findUnique({
      where: { id: params.id },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!product) notFound();

  const serialized = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description ?? undefined,
    categoryId: product.categoryId,
    brandId: product.brandId ?? undefined,
    gender: product.gender ?? undefined,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    tags: product.tags,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      price: Number(v.price),
      costPrice: v.costPrice ? Number(v.costPrice) : null,
      barcode: v.barcode,
      stock: v.stock,
      stockAlert: v.stockAlert,
      isActive: v.isActive,
    })),
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <Link href="/admin/productos" className="hover:text-gray-600">Productos</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-700 font-medium">{product.name}</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar producto</h1>
      <ProductForm product={serialized} categories={categories} brands={brands} />
    </div>
  );
}
