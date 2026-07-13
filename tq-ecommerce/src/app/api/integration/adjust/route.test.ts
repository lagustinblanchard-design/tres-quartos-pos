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
  return new NextRequest("http://localhost/api/integration/adjust", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
}

describe("POST /api/integration/adjust", () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_KEY = "secreta";
    const fake = createFakePrisma([{ id: "v1", sku: "TQ-RUG-camiseta-M", stock: 7 }]);
    (prisma.productVariant.findMany as any).mockImplementation(fake.prisma.productVariant.findMany);
    (prisma.productVariant.findUnique as any).mockImplementation(fake.prisma.productVariant.findUnique);
    (prisma.productVariant.update as any).mockImplementation(fake.prisma.productVariant.update);
    (prisma.productVariant.updateMany as any).mockImplementation(fake.prisma.productVariant.updateMany);
    (prisma.stockMovement.findFirst as any).mockImplementation(fake.prisma.stockMovement.findFirst);
    (prisma.stockMovement.create as any).mockImplementation(fake.prisma.stockMovement.create);
    (prisma.$transaction as any).mockImplementation(fake.prisma.$transaction);
    (globalThis as any).__fake = fake;
  });

  it("ajusta el stock a un valor absoluto por conteo físico", async () => {
    const res = await POST(
      postReq({ sku: "TQ-RUG-camiseta-M", quantity: 5, reason: "conteo físico" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sku: "TQ-RUG-camiseta-M", stock: 5 });
    expect(body.movimiento).toMatchObject({ previousQty: 7, newQty: 5 });
  });

  it("SKU inexistente responde 404", async () => {
    const res = await POST(postReq({ sku: "NO-EXISTE", quantity: 1, reason: "x" }));
    expect(res.status).toBe(404);
  });
});
