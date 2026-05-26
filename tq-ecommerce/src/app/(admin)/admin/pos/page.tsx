import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { POSTerminal } from "@/components/admin/pos-terminal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Punto de Venta — Admin" };

export default async function POSPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const openSession = await prisma.posSession.findFirst({
    where: { userId: session.user.id, closedAt: null },
    select: {
      id: true,
      openingCash: true,
      openedAt: true,
      totalSales: true,
      totalCash: true,
      totalCard: true,
      totalTransfer: true,
      totalMp: true,
    },
  });

  const serializedSession = openSession
    ? {
        id: openSession.id,
        openingCash: Number(openSession.openingCash),
        openedAt: openSession.openedAt.toISOString(),
        totalSales: Number(openSession.totalSales),
        totalCash: Number(openSession.totalCash),
        totalCard: Number(openSession.totalCard),
        totalTransfer: Number(openSession.totalTransfer),
        totalMp: Number(openSession.totalMp),
      }
    : null;

  return <POSTerminal initialSession={serializedSession} />;
}
