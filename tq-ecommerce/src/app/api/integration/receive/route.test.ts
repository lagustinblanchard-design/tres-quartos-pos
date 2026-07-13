import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakePrisma } from "@/test-utils/fake-prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productVariant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    stockMovement: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

function postReq(body: unknown, apiKey = "secreta") {
  return new NextRequest("http://localhost/api/integration/receive", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
}

describe("POST /api/integration/receive", () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_KEY = "secreta";
    const fake = createFakePrisma([{ id: "v1", sku: "TQ-RUG-camiseta-M", stock: 5, costPrice: 1000 }]);
    (prisma.productVariant.findMany as any).mockImplementation(fake.prisma.productVariant.findMany);
    (prisma.productVariant.findUnique as any).mockImplementation(fake.prisma.productVariant.findUnique);
    (prisma.productVariant.update as any).mockImplementation(fake.prisma.productVariant.update);
    (prisma.productVariant.updateMany as any).mockImplementation(fake.prisma.productVariant.updateMany);
    (prisma.stockMovement.findFirst as any).mockImplementation(fake.prisma.stockMovement.findFirst);
    (prisma.stockMovement.create as any).mockImplementation(fake.prisma.stockMovement.create);
    (prisma.$transaction as any).mockImplementation(fake.prisma.$transaction);
    (globalThis as any).__fake = fake;
  });

  it("incrementa stock y actualiza el costo cuando se informa", async () => {
    const res = await POST(
      postReq({ items: [{ sku: "TQ-RUG-camiseta-M", quantity: 10, unitCost: 5000 }], reference: "OC-1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variantes[0]).toMatchObject({ sku: "TQ-RUG-camiseta-M", stock: 15, costo: 5000 });

    const fake = (globalThis as any).__fake as ReturnType<typeof createFakePrisma>;
    expect(fake.movements[0]).toMatchObject({ type: "ENTRADA", previousQty: 5, newQty: 15 });
  });

  it("SKU inexistente responde 400", async () => {
    const res = await POST(postReq({ items: [{ sku: "NO-EXISTE", quantity: 1 }] }));
    expect(res.status).toBe(400);
  });
});
