import type { Prisma } from "@prisma/client";

export type TxClient = Prisma.TransactionClient;

export interface SaleItem {
  variantId: string;
  quantity: number;
}

export interface StockFailure {
  variantId: string;
  requested: number;
  available: number | null;
}

export class InsufficientStockError extends Error {
  constructor(public failures: StockFailure[]) {
    super("Stock insuficiente para uno o más ítems");
    this.name = "InsufficientStockError";
  }
}

export class VariantNotFoundError extends Error {
  constructor(public variantId: string) {
    super(`Variante ${variantId} no encontrada`);
    this.name = "VariantNotFoundError";
  }
}

export interface MovementMeta {
  reason?: string;
  reference?: string;
  userId?: string;
}

/**
 * Descuenta stock para una venta. Todo-o-nada: si algún ítem no tiene stock
 * suficiente, ningún ítem se modifica (lanza InsufficientStockError; el
 * caller debe correr esto dentro de una transacción que haga rollback).
 * El descuento es condicional y atómico a nivel de fila
 * (UPDATE ... WHERE stock >= cantidad): no hay lectura-luego-escritura
 * que permita sobreventa entre requests concurrentes por la misma variante.
 */
export async function decrementStockForSale(
  tx: TxClient,
  items: SaleItem[],
  meta: MovementMeta = {}
): Promise<void> {
  const failures: StockFailure[] = [];
  const applied: SaleItem[] = [];

  for (const item of items) {
    const result = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });

    if (result.count === 0) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { stock: true },
      });
      failures.push({
        variantId: item.variantId,
        requested: item.quantity,
        available: variant ? variant.stock : null,
      });
      continue;
    }

    applied.push(item);
  }

  if (failures.length > 0) {
    // Compensar los descuentos ya aplicados antes de reportar el fallo, para
    // que la función sea atómica por sí misma incluso si el caller no la
    // corre dentro de una transacción de base de datos (en producción
    // siempre corre dentro de prisma.$transaction, donde esto es además
    // invisible para otras transacciones hasta el commit).
    for (const item of applied) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    throw new InsufficientStockError(failures);
  }

  for (const item of applied) {
    const variant = await tx.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stock: true },
    });
    const newQty = variant!.stock;
    await tx.stockMovement.create({
      data: {
        variantId: item.variantId,
        type: "VENTA",
        quantity: item.quantity,
        previousQty: newQty + item.quantity,
        newQty,
        reason: meta.reason,
        reference: meta.reference,
        userId: meta.userId,
      },
    });
  }
}

/**
 * Incrementa stock (recepción de compra) y opcionalmente actualiza el
 * costo de la variante. No es condicional: sumar stock nunca falla por
 * disponibilidad.
 */
export async function receiveStock(
  tx: TxClient,
  items: (SaleItem & { unitCost?: number })[],
  meta: MovementMeta = {}
): Promise<void> {
  for (const item of items) {
    const before = await tx.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stock: true },
    });
    if (!before) throw new VariantNotFoundError(item.variantId);

    const data: Prisma.ProductVariantUpdateInput = { stock: { increment: item.quantity } };
    if (item.unitCost !== undefined) data.costPrice = item.unitCost;

    await tx.productVariant.update({ where: { id: item.variantId }, data });

    await tx.stockMovement.create({
      data: {
        variantId: item.variantId,
        type: "ENTRADA",
        quantity: item.quantity,
        previousQty: before.stock,
        newQty: before.stock + item.quantity,
        reason: meta.reason,
        reference: meta.reference,
        userId: meta.userId,
      },
    });
  }
}

/**
 * Ajusta el stock de una variante. ENTRADA/SALIDA son relativos al stock
 * actual; AJUSTE fija el valor absoluto (`quantity` es el nuevo stock, no
 * un delta). Usado por el panel admin y por el ajuste absoluto de la API
 * de integración.
 */
export async function applyStockAdjustment(
  tx: TxClient,
  variantId: string,
  type: "ENTRADA" | "SALIDA" | "AJUSTE",
  quantity: number,
  meta: MovementMeta = {}
) {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new VariantNotFoundError(variantId);

  let newStock: number;
  if (type === "ENTRADA") {
    newStock = variant.stock + quantity;
  } else if (type === "SALIDA") {
    newStock = Math.max(0, variant.stock - quantity);
  } else {
    newStock = quantity;
  }

  const updatedVariant = await tx.productVariant.update({
    where: { id: variantId },
    data: { stock: newStock },
  });

  const movement = await tx.stockMovement.create({
    data: {
      variantId,
      type,
      quantity: type === "AJUSTE" ? newStock - variant.stock : quantity,
      previousQty: variant.stock,
      newQty: newStock,
      reason: meta.reason,
      reference: meta.reference,
      userId: meta.userId,
    },
  });

  return { variant: updatedVariant, movement };
}
