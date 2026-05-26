import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { ProductDetail } from "@/components/store/product-detail";
import { RelatedProducts } from "@/components/store/related-products";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Props = { params: { slug: string } };

// Genera metadatos dinámicos para SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug, isActive: true },
    include: { brand: true },
  });
  if (!product) return { title: "Producto no encontrado" };

  return {
    title: product.name,
    description: product.description ?? `${product.name} — TQ Deportes`,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
    },
  };
}

// Función que carga todo el producto con sus relaciones
async function getProduct(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        where: { isActive: true },
        orderBy: [{ color: "asc" }, { size: "asc" }],
      },
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { name: true } },
      reviews: {
        where: { isVisible: true },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });
  return product;
}

async function getRelated(categoryId: string, excludeId: string) {
  return prisma.product.findMany({
    where: { categoryId, isActive: true, id: { not: excludeId } },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        take: 1,
      },
    },
    take: 4,
    orderBy: { createdAt: "desc" },
  });
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const related = await getRelated(product.category.id, product.id);

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
      : 0;

  // Serializar decimals de Prisma a numbers para el client component
  const serialized = {
    ...product,
    variants: product.variants.map((v) => ({
      ...v,
      price: Number(v.price),
      costPrice: v.costPrice ? Number(v.costPrice) : null,
    })),
    avgRating,
  };

  const serializedRelated = related.map((r) => ({
    ...r,
    variants: r.variants.map((v) => ({
      ...v,
      price: Number(v.price),
      costPrice: v.costPrice ? Number(v.costPrice) : null,
    })),
  }));

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-600">Inicio</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/catalogo" className="hover:text-blue-600">Catálogo</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/catalogo?cat=${product.category.slug}`} className="hover:text-blue-600">
          {product.category.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      <ProductDetail product={serialized} />

      {/* Related products */}
      {serializedRelated.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">También te puede interesar</h2>
          <RelatedProducts products={serializedRelated} />
        </div>
      )}
    </div>
  );
}
