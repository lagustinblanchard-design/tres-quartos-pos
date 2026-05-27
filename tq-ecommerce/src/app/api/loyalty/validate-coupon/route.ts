import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateCoupon } from "@/lib/loyalty";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ valid: false, error: "Código requerido" });

  const result = await validateCoupon(String(code).trim().toUpperCase(), session.user.id);
  return NextResponse.json(result);
}
