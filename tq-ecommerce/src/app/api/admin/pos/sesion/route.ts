import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// POST → abrir sesión
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = z.object({ openingCash: z.number().min(0) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  // Verificar que no haya sesión abierta
  const open = await prisma.posSession.findFirst({
    where: { userId: session.user.id, closedAt: null },
  });
  if (open) {
    return NextResponse.json({ error: "Ya hay una sesión abierta", sessionId: open.id }, { status: 409 });
  }

  const posSession = await prisma.posSession.create({
    data: {
      userId: session.user.id,
      openingCash: parsed.data.openingCash,
    },
    select: { id: true, openingCash: true, openedAt: true },
  });

  return NextResponse.json(posSession, { status: 201 });
}

// PATCH → cerrar sesión
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = z.object({
    sessionId: z.string(),
    closingCash: z.number().min(0),
    notes: z.string().optional(),
  }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const updated = await prisma.posSession.update({
    where: { id: parsed.data.sessionId, userId: session.user.id },
    data: {
      closedAt: new Date(),
      closingCash: parsed.data.closingCash,
      notes: parsed.data.notes,
    },
    select: {
      id: true,
      openingCash: true,
      closingCash: true,
      totalSales: true,
      openedAt: true,
      closedAt: true,
    },
  });

  return NextResponse.json(updated);
}
