import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIntegrationApiKey } from "@/lib/integration-auth";

/**
 * GET /api/integration/catalog?q=<término>
 * Búsqueda de catálogo para el POS Flask (routes/ventas.py::api_productos
 * en modo api). Responde keyed por SKU, nunca por IDs internos de Prisma.
 */
export async function GET(req: NextRequest) {
  const authError = requireIntegrationApiKey(req);
  if (authError) return authError;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
              { variants: { some: { sku: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    select: {
      sku: true,
      name: true,
      variants: {
        where: { isActive: true },
        select: { sku: true, size: true, color: true, price: true, stock: true, stockAlert: true },
        orderBy: [{ size: "asc" }, { color: "asc" }],
      },
    },
    take: 50,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    products: products
      .filter((p) => p.variants.length > 0)
      .map((p) => ({
        sku: p.sku,
        nombre: p.name,
        variantes: p.variants.map((v) => ({
          sku: v.sku,
          talla: v.size ?? "",
          color: v.color ?? "",
          precio: Number(v.price),
          stock: v.stock,
          stockMinimo: v.stockAlert,
        })),
      })),
  });
}
