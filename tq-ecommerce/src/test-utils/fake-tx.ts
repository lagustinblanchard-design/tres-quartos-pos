import type { TxClient } from "@/lib/inventory";

/**
 * Fake Prisma transaction client used to unit-test src/lib/inventory.ts
 * without a live Postgres instance. It models exactly the subset of
 * behavior our inventory functions rely on:
 *
 *  - `productVariant.updateMany` with a `stock: { gte }` guard mirrors
 *    Postgres' row-level atomicity: the WHERE clause is evaluated against
 *    the current in-memory state at call time, so calling it repeatedly
 *    ("interleaved" by the test) reproduces the same all-or-nothing
 *    guarantee the real conditional UPDATE gives us against concurrent
 *    requests.
 *  - `stockMovement.create` records are appended to `movements` so tests
 *    can assert the ledger.
 *
 * This validates the *logic* (atomic guard, all-or-nothing, ledger
 * correctness). It intentionally does not exercise real Postgres MVCC/
 * locking — that would require an integration test against a live
 * database with two genuinely parallel transactions.
 */
export interface FakeVariant {
  id: string;
  stock: number;
  costPrice?: number | null;
}

export function createFakeTx(initialVariants: FakeVariant[]) {
  const variants = new Map<string, FakeVariant>(initialVariants.map((v) => [v.id, { ...v }]));
  const movements: any[] = [];
  let movementSeq = 0;

  const tx = {
    productVariant: {
      async updateMany({ where, data }: any) {
        const v = variants.get(where.id);
        if (!v) return { count: 0 };
        if (where.stock?.gte !== undefined && v.stock < where.stock.gte) {
          return { count: 0 };
        }
        if (data.stock?.decrement !== undefined) v.stock -= data.stock.decrement;
        if (data.stock?.increment !== undefined) v.stock += data.stock.increment;
        return { count: 1 };
      },
      async findUnique({ where }: any) {
        const v = variants.get(where.id);
        return v ? { ...v } : null;
      },
      async update({ where, data }: any) {
        const v = variants.get(where.id);
        if (!v) throw new Error("record not found");
        if (typeof data.stock === "number") v.stock = data.stock;
        else if (data.stock?.increment !== undefined) v.stock += data.stock.increment;
        else if (data.stock?.decrement !== undefined) v.stock -= data.stock.decrement;
        if (data.costPrice !== undefined) v.costPrice = data.costPrice;
        return { ...v };
      },
    },
    stockMovement: {
      async create({ data }: any) {
        const movement = { id: `mv-${++movementSeq}`, ...data };
        movements.push(movement);
        return movement;
      },
    },
  };

  return { tx: tx as unknown as TxClient, variants, movements };
}
