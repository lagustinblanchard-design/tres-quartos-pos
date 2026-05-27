import { prisma } from "@/lib/prisma";

export const LOYALTY_MIN_PURCHASE = 30_000; // ARS mínimo para que cuente

const MILESTONES: { count: number; discount: number }[] = [
  { count: 3,  discount: 15 },
  { count: 5,  discount: 25 },
  { count: 10, discount: 50 },
  { count: 20, discount: 60 },
];

function getMilestoneDiscount(count: number): number | null {
  const milestone = MILESTONES.find((m) => m.count === count);
  if (milestone) return milestone.discount;
  // Cada 10 compras después de 20 → 60%
  if (count > 20 && (count - 20) % 10 === 0) return 60;
  return null;
}

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "TRY-" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function processLoyaltyPurchase(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.userId) return; // solo clientes registrados
  if (Number(order.total) < LOYALTY_MIN_PURCHASE) return;

  // Evitar doble conteo
  const existing = await prisma.loyaltyTransaction.findUnique({ where: { orderId } });
  if (existing) return;

  // Obtener o crear la cuenta de fidelidad
  let account = await prisma.loyaltyAccount.findUnique({ where: { userId: order.userId } });
  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: { userId: order.userId, qualifyingCount: 0 },
    });
  }

  const newCount = account.qualifyingCount + 1;

  await prisma.$transaction(async (tx) => {
    await tx.loyaltyTransaction.create({
      data: {
        userId: order.userId!,
        orderId,
        orderTotal: order.total,
        purchaseNumber: newCount,
      },
    });
    await tx.loyaltyAccount.update({
      where: { userId: order.userId! },
      data: { qualifyingCount: newCount },
    });
  });

  // Verificar si se alcanzó un hito
  const discount = getMilestoneDiscount(newCount);
  if (discount) {
    // Verificar que no tenga ya un cupón sin usar para este hito
    const existingCoupon = await prisma.loyaltyCoupon.findFirst({
      where: { userId: order.userId, milestone: newCount, isUsed: false },
    });
    if (!existingCoupon) {
      await prisma.loyaltyCoupon.create({
        data: {
          userId: order.userId!,
          code: generateCouponCode(),
          discountPct: discount,
          milestone: newCount,
          expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 meses
        },
      });
    }
  }
}

export async function getLoyaltyStatus(userId: string) {
  const account = await prisma.loyaltyAccount.findUnique({
    where: { userId },
    include: {
      coupons: {
        where: { isUsed: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const count = account?.qualifyingCount ?? 0;
  const nextMilestone = MILESTONES.find((m) => m.count > count) ?? { count: 20, discount: 60 };
  const progressPct = Math.min(100, Math.round((count / nextMilestone.count) * 100));

  return {
    qualifyingCount: count,
    nextMilestone,
    progressPct,
    availableCoupons: account?.coupons ?? [],
    minPurchase: LOYALTY_MIN_PURCHASE,
  };
}

export async function validateCoupon(code: string, userId: string) {
  const coupon = await prisma.loyaltyCoupon.findUnique({ where: { code } });
  if (!coupon) return { valid: false, error: "Cupón inválido" };
  if (coupon.userId !== userId) return { valid: false, error: "Cupón inválido" };
  if (coupon.isUsed) return { valid: false, error: "El cupón ya fue usado" };
  if (coupon.expiresAt < new Date()) return { valid: false, error: "El cupón expiró" };
  return { valid: true, coupon };
}

export async function redeemCoupon(code: string, orderId: string) {
  await prisma.loyaltyCoupon.update({
    where: { code },
    data: { isUsed: true, usedAt: new Date(), usedOnOrderId: orderId },
  });
}
