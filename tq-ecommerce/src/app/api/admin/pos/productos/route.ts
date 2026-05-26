import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
              { product: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    take: 30,
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      price: true,
      stock: true,
      product: { select: { name: true } },
    },
    orderBy: { product: { name: "asc" } },
  });

  return NextResponse.json(
    variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.product.name,
      variant: [v.color, v.size ? `T. ${v.size}` : null].filter(Boolean).join(" / "),
      price: Number(v.price),
      stock: v.stock,
    }))
  );
}
