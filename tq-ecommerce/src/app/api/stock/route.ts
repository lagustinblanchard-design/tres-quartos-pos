import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? ""; // "critical" | "low" | "ok" | "out"
  const categoryId = searchParams.get("category") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 50;

  const where = {
    isActive: true,
    product: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    ...(search
      ? {
          OR: [
            { sku: { contains: search, mode: "insensitive" as const } },
            { barcode: { contains: search, mode: "insensitive" as const } },
            { color: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const variants = await prisma.productVariant.findMany({
    where,
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
    skip: (page - 1) * limit,
    take: limit,
  });

  // Filtrar por estado después de la query (más simple)
  const filtered = variants.filter((v) => {
    if (status === "out") return v.stock === 0;
    if (status === "critical") return v.stock > 0 && v.stock <= v.stockAlert;
    if (status === "ok") return v.stock > v.stockAlert;
    return true;
  });

  const total = await prisma.productVariant.count({ where });

  // Conteos para las tabs
  const allVariants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    select: { stock: true, stockAlert: true },
  });
  const counts = {
    total: allVariants.length,
    out: allVariants.filter((v) => v.stock === 0).length,
    critical: allVariants.filter((v) => v.stock > 0 && v.stock <= v.stockAlert).length,
    ok: allVariants.filter((v) => v.stock > v.stockAlert).length,
  };

  return NextResponse.json({
    variants: filtered.map((v) => ({
      ...v,
      price: Number(v.price),
      costPrice: v.costPrice ? Number(v.costPrice) : null,
    })),
    total,
    counts,
    page,
    pages: Math.ceil(total / limit),
  });
}
