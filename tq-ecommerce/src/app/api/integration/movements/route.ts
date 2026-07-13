import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIntegrationApiKey } from "@/lib/integration-auth";

/**
 * GET /api/integration/movements?reference=<prefijo>
 * Solo lectura. Usado por el reporte de consistencia del POS Flask
 * (reporte_consistencia.py) para cruzar sus ventas contra el ledger
 * canónico por referencia — ver tasks.md 5.1.
 */
export async function GET(req: NextRequest) {
  const authError = requireIntegrationApiKey(req);
  if (authError) return authError;

  const prefix = req.nextUrl.searchParams.get("reference") ?? "";

  const movements = await prisma.stockMovement.findMany({
    where: prefix ? { reference: { startsWith: prefix } } : {},
    select: { reference: true, type: true, quantity: true, variantId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });

  return NextResponse.json({
    movements: movements.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
}
