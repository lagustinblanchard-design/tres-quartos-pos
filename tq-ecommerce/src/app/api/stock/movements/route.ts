import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const variantId = searchParams.get("variantId") ?? "";
  const type = searchParams.get("type") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 50;

  const where = {
    ...(variantId ? { variantId } : {}),
    ...(type ? { type: type as "ENTRADA" | "SALIDA" | "AJUSTE" | "DEVOLUCION" | "VENTA" } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
          },
        }
      : {}),
  };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        variant: {
          include: {
            product: { select: { name: true, sku: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return NextResponse.json({ movements, total, page, pages: Math.ceil(total / limit) });
}
