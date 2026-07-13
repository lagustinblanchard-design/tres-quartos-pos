import { describe, it, expect } from "vitest";
import {
  decrementStockForSale,
  receiveStock,
  applyStockAdjustment,
  InsufficientStockError,
  VariantNotFoundError,
} from "@/lib/inventory";
import { createFakeTx } from "@/test-utils/fake-tx";

describe("decrementStockForSale", () => {
  it("descuenta stock y crea un StockMovement por ítem", async () => {
    const { tx, variants, movements } = createFakeTx([{ id: "v1", stock: 10 }]);

    await decrementStockForSale(tx, [{ variantId: "v1", quantity: 2 }], {
      reason: "Venta POS",
      reference: "POS #1",
    });

    expect(variants.get("v1")!.stock).toBe(8);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      variantId: "v1",
      type: "VENTA",
      quantity: 2,
      previousQty: 10,
      newQty: 8,
      reference: "POS #1",
    });
  });

  it("rechaza todo-o-nada si un ítem no tiene stock suficiente", async () => {
    const { tx, variants, movements } = createFakeTx([
      { id: "v1", stock: 10 },
      { id: "v2", stock: 1 },
    ]);

    await expect(
      decrementStockForSale(tx, [
        { variantId: "v1", quantity: 2 },
        { variantId: "v2", quantity: 5 },
      ])
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // Nada se modifica: v1 no debe quedar parcialmente descontado
    expect(variants.get("v1")!.stock).toBe(10);
    expect(variants.get("v2")!.stock).toBe(1);
    expect(movements).toHaveLength(0);
  });

  it("dos ventas concurrentes por la última unidad: exactamente una gana", async () => {
    // Simula la carrera descrita en la spec inventory-core: dos requests
    // "concurrentes" compitiendo por la última unidad de una variante.
    // El guard `stock >= qty` en el UPDATE condicional (ver fake-tx.ts)
    // reproduce la garantía de atomicidad de fila de Postgres.
    const { tx, variants, movements } = createFakeTx([{ id: "v1", stock: 1 }]);

    const results = await Promise.allSettled([
      decrementStockForSale(tx, [{ variantId: "v1", quantity: 1 }], { reference: "sale-A" }),
      decrementStockForSale(tx, [{ variantId: "v1", quantity: 1 }], { reference: "sale-B" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);
    expect(variants.get("v1")!.stock).toBe(0);
    expect(movements).toHaveLength(1);
  });

  it("variante inexistente se reporta como falla sin lanzar excepción no controlada", async () => {
    const { tx } = createFakeTx([]);

    await expect(
      decrementStockForSale(tx, [{ variantId: "no-existe", quantity: 1 }])
    ).rejects.toMatchObject({
      failures: [{ variantId: "no-existe", requested: 1, available: null }],
    });
  });
});

describe("receiveStock", () => {
  it("incrementa stock y actualiza costPrice cuando se informa", async () => {
    const { tx, variants, movements } = createFakeTx([{ id: "v1", stock: 5, costPrice: 100 }]);

    await receiveStock(tx, [{ variantId: "v1", quantity: 10, unitCost: 5000 }], {
      reason: "Recepción de compra",
    });

    const v1 = variants.get("v1")!;
    expect(v1.stock).toBe(15);
    expect(v1.costPrice).toBe(5000);
    expect(movements[0]).toMatchObject({ type: "ENTRADA", previousQty: 5, newQty: 15, quantity: 10 });
  });

  it("lanza VariantNotFoundError si la variante no existe", async () => {
    const { tx } = createFakeTx([]);
    await expect(receiveStock(tx, [{ variantId: "x", quantity: 1 }])).rejects.toBeInstanceOf(
      VariantNotFoundError
    );
  });
});

describe("applyStockAdjustment", () => {
  it("ENTRADA suma al stock actual", async () => {
    const { tx } = createFakeTx([{ id: "v1", stock: 5 }]);
    const { movement } = await applyStockAdjustment(tx, "v1", "ENTRADA", 3);
    expect(movement).toMatchObject({ previousQty: 5, newQty: 8, quantity: 3 });
  });

  it("SALIDA nunca deja stock negativo", async () => {
    const { tx } = createFakeTx([{ id: "v1", stock: 2 }]);
    const { movement } = await applyStockAdjustment(tx, "v1", "SALIDA", 5);
    expect(movement.newQty).toBe(0);
  });

  it("AJUSTE fija un valor absoluto", async () => {
    const { tx } = createFakeTx([{ id: "v1", stock: 7 }]);
    const { movement } = await applyStockAdjustment(tx, "v1", "AJUSTE", 5);
    expect(movement).toMatchObject({ previousQty: 7, newQty: 5, quantity: -2 });
  });
});
