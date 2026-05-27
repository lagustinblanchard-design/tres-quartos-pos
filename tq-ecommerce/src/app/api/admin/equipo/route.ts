import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId, role } = await req.json();
  if (!userId || !["ADMIN", "CLIENTE"].includes(role)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // No puede quitarse el admin a sí mismo
  if (userId === session.user.id && role !== "ADMIN") {
    return NextResponse.json({ error: "No podés quitarte el rol admin a vos mismo" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}
