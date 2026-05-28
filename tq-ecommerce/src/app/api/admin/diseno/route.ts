import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DISENO_KEYS = [
  "homepage_hero",
  "homepage_banners",
  "homepage_cta",
];

export async function GET() {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configs = await prisma.businessConfig.findMany({
    where: { key: { in: DISENO_KEYS } },
  });
  const result = Object.fromEntries(configs.map((c) => [c.key, JSON.parse(c.value)]));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  await Promise.all(
    Object.entries(body)
      .filter(([key]) => DISENO_KEYS.includes(key))
      .map(([key, value]) =>
        prisma.businessConfig.upsert({
          where: { key },
          update: { value: JSON.stringify(value) },
          create: { key, value: JSON.stringify(value) },
        })
      )
  );

  return NextResponse.json({ ok: true });
}
