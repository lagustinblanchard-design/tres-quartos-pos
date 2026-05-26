import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  configs: z.record(z.string(), z.string()),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { configs } = parsed.data;

  // Upsert each config key
  await prisma.$transaction(
    Object.entries(configs).map(([key, value]) =>
      prisma.businessConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const configs = await prisma.businessConfig.findMany();
  return NextResponse.json(Object.fromEntries(configs.map((c) => [c.key, c.value])));
}
