import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug, isActive: true },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        where: { isActive: true },
        orderBy: [{ size: "asc" }, { color: "asc" }],
      },
      category: { select: { name: true, slug: true } },
      brand: { select: { name: true } },
      reviews: {
        where: { isVisible: true },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
      : 0;

  return NextResponse.json({ ...product, avgRating });
}
