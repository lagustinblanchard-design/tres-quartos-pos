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
  return new NextRequest("http://localhost/api/integration/sale", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
}

describe("POST /api/integration/sale", () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_KEY = "secreta";
    const fake = createFakePrisma([
      { id: "v1", sku: "TQ-RUG-camiseta-M", stock: 5 },
      { id: "v2", sku: "TQ-RUG-camiseta-L", stock: 1 },
    ]);
    (prisma.productVariant.findMany as any).mockImplementation(fake.prisma.productVariant.findMany);
    (prisma.productVariant.findUnique as any).mockImplementation(fake.prisma.productVariant.findUnique);
    (prisma.productVariant.update as any).mockImplementation(fake.prisma.productVariant.update);
    (prisma.productVariant.updateMany as any).mockImplementation(fake.prisma.productVariant.updateMany);
    (prisma.stockMovement.findFirst as any).mockImplementation(fake.prisma.stockMovement.findFirst);
    (prisma.stockMovement.create as any).mockImplementation(fake.prisma.stockMovement.create);
    (prisma.$transaction as any).mockImplementation(fake.prisma.$transaction);
    (globalThis as any).__fake = fake;
  });

  it("rechaza sin API key", async () => {
    const res = await POST(postReq({ reference: "FLASK-POS #1", items: [] }, "mala"));
    expect(res.status).toBe(401);
  });

  it("descuenta stock de una venta multi-ítem exitosa", async () => {
    const res = await POST(
      postReq({
        reference: "FLASK-POS #841",
        items: [
          { sku: "TQ-RUG-camiseta-M", quantity: 2 },
          { sku: "TQ-RUG-camiseta-L", quantity: 1 },
        ],
      })
    );
    expect(res.status).toBe(200);
    const fake = (globalThis as any).__fake as ReturnType<typeof createFakePrisma>;
    expect(fake.variants.get("v1")!.stock).toBe(3);
    expect(fake.variants.get("v2")!.stock).toBe(0);
    expect(fake.movements).toHaveLength(2);
    expect(fake.movements.every((m) => m.reference === "FLASK-POS #841")).toBe(true);
  });

  it("stock insuficiente en un ítem: no descuenta ningún ítem y responde 409", async () => {
    const res = await POST(
      postReq({
        reference: "FLASK-POS #842",
        items: [
          { sku: "TQ-RUG-camiseta-M", quantity: 1 },
          { sku: "TQ-RUG-camiseta-L", quantity: 5 }, // solo hay 1
        ],
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.details).toEqual([{ sku: "TQ-RUG-camiseta-L", requested: 5, available: 1 }]);

    const fake = (globalThis as any).__fake as ReturnType<typeof createFakePrisma>;
    expect(fake.variants.get("v1")!.stock).toBe(5); // sin cambios
    expect(fake.movements).toHaveLength(0);
  });

  it("referencia duplicada no vuelve a descontar stock", async () => {
    const payload = {
      reference: "FLASK-POS #900",
      items: [{ sku: "TQ-RUG-camiseta-M", quantity: 2 }],
    };
    const res1 = await POST(postReq(payload));
    expect(res1.status).toBe(200);

    const res2 = await POST(postReq(payload));
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.duplicate).toBe(true);

    const fake = (globalThis as any).__fake as ReturnType<typeof createFakePrisma>;
    expect(fake.variants.get("v1")!.stock).toBe(3); // solo se descontó una vez
    expect(fake.movements).toHaveLength(1);
  });

  it("SKU inexistente responde 400", async () => {
    const res = await POST(
      postReq({ reference: "FLASK-POS #1", items: [{ sku: "NO-EXISTE", quantity: 1 }] })
    );
    expect(res.status).toBe(400);
  });
});
