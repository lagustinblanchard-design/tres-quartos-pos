import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  status: z.enum([
    "PENDIENTE",
    "CONFIRMADO",
    "EN_PREPARACION",
    "DESPACHADO",
    "ENTREGADO",
    "CANCELADO",
    "DEVUELTO",
  ]).optional(),
  trackingCode: z.string().optional(),
  notes: z.string().optional(),
});

// Valid transitions
const VALID_NEXT: Record<string, string[]> = {
  PENDIENTE: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["EN_PREPARACION", "CANCELADO"],
  EN_PREPARACION: ["DESPACHADO", "CANCELADO"],
  DESPACHADO: ["ENTREGADO"],
  ENTREGADO: ["DEVUELTO"],
  CANCELADO: [],
  DEVUELTO: [],
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status, trackingCode, notes } = parsed.data;

  if (status) {
    const allowed = VALID_NEXT[order.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Transición inválida: ${order.status} → ${status}` },
        { status: 422 }
      );
    }
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      ...(status ? { status } : {}),
      ...(trackingCode !== undefined ? { trackingCode } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    select: { id: true, status: true, trackingCode: true },
  });

  return NextResponse.json(updated);
}
