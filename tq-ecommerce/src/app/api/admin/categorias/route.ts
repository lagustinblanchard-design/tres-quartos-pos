import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cats = await prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = z.object({ name: z.string().min(2) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });

  const slug = parsed.data.name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });

  const cat = await prisma.category.create({
    data: { name: parsed.data.name, slug },
    select: { id: true, name: true },
  });

  return NextResponse.json(cat, { status: 201 });
}
