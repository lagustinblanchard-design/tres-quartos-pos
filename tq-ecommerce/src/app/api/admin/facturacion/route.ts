import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["FACTURA_A", "FACTURA_B", "REMITO", "NOTA_CREDITO", "NOTA_DEBITO", "TICKET"]),
  series: z.string().default("0001"),
  orderId: z.string().optional(),
  userId: z.string().optional(),
  clientName: z.string().min(1, "Nombre requerido"),
  clientDni: z.string().optional(),
  clientCuit: z.string().optional(),
  clientEmail: z.string().optional(),
  clientAddr: z.string().optional(),
  subtotal: z.number().min(0),
  iva: z.number().min(0).default(0),
  total: z.number().min(0),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  const q = sp.get("q") ?? "";
  const from = sp.get("from");
  const to = sp.get("to");

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(type ? { type: type as never } : {}),
      ...(q ? { OR: [
        { clientName: { contains: q, mode: "insensitive" } },
        { clientCuit: { contains: q, mode: "insensitive" } },
      ]} : {}),
      ...(from || to ? { createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
      }} : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      order: { select: { number: true } },
    },
  });

  return NextResponse.json(invoices.map((inv) => ({
    id: inv.id,
    type: inv.type,
    series: inv.series,
    number: inv.number,
    clientName: inv.clientName,
    clientCuit: inv.clientCuit,
    subtotal: Number(inv.subtotal),
    iva: Number(inv.iva),
    total: Number(inv.total),
    afipCae: inv.afipCae,
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    orderNumber: inv.order?.number ?? null,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { type, series, ...data } = parsed.data;

  const invoice = await prisma.$transaction(async (tx) => {
    // Auto-increment number per type+series
    const last = await tx.invoice.findFirst({
      where: { type, series },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;

    return tx.invoice.create({
      data: { type, series, number, ...data },
      select: { id: true, type: true, series: true, number: true },
    });
  });

  return NextResponse.json(invoice, { status: 201 });
}
