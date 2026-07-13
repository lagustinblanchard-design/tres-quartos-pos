import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakePrisma } from "@/test-utils/fake-prisma";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1", role: "ADMIN" } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productVariant: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    purchaseOrder: { findUnique: vi.fn(), update: vi.fn() },
    stockMovement: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { POST } from "./route";

function wire(fake: ReturnType<typeof createFakePrisma>) {
  (prisma.productVariant.findMany as any).mockImplementation(fake.prisma.productVariant.findMany);
  (prisma.productVariant.findUnique as any).mockImplementation(fake.prisma.productVariant.findUnique);
  (prisma.productVariant.update as any).mockImplementation(fake.prisma.productVariant.update);
  (prisma.productVariant.updateMany as any).mockImplementation(fake.prisma.productVariant.updateMany);
  (prisma.purchaseOrder.findUnique as any).mockImplementation(fake.prisma.purchaseOrder.findUnique);
  (prisma.purchaseOrder.update as any).mockImplementation(fake.prisma.purchaseOrder.update);
  (prisma.stockMovement.findFirst as any).mockImplementation(fake.prisma.stockMovement.findFirst);
  (prisma.stockMovement.create as any).mockImplementation(fake.prisma.stockMovement.create);
  (prisma.$transaction as any).mockImplementation(fake.prisma.$transaction);
}

function req() {
  return new NextRequest("http://localhost/api/admin/compras/po-1/recibir", { method: "POST" });
}

describe("POST /api/admin/compras/[id]/recibir", () => {
  beforeEach(() => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  });

  it("rechaza sin sesión", async () => {
    (auth as any).mockResolvedValueOnce(null);
    const fake = createFakePrisma({});
    wire(fake);
    const res = await POST(req(), { params: { id: "po-1" } });
    expect(res.status).toBe(401);
  });

  it("404 si la orden no existe", async () => {
    const fake = createFakePrisma({});
    wire(fake);
    const res = await POST(req(), { params: { id: "no-existe" } });
    expect(res.status).toBe(404);
  });

  it("incrementa stock, registra ENTRADA y marca la orden como recibida", async () => {
    const fake = createFakePrisma({
      variants: [{ id: "v1", sku: "TQ-CAM-argentina-M", stock: 5, costPrice: null }],
      suppliers: [{ id: "sup-1", name: "IMAGO" }],
      purchaseOrders: [
        {
          id: "po-1",
          supplierId: "sup-1",
          status: "PENDIENTE",
          total: null,
          items: [{ id: "i1", variantSku: "TQ-CAM-argentina-M", quantity: 10, unitCost: 5000 }],
        },
      ],
    });
    wire(fake);

    const res = await POST(req(), { params: { id: "po-1" } });
    expect(res.status).toBe(200);

    expect(fake.variants.get("v1")!.stock).toBe(15);
    expect(fake.variants.get("v1")!.costPrice).toBe(5000);
    expect(fake.movements).toHaveLength(1);
    expect(fake.movements[0]).toMatchObject({ type: "ENTRADA", previousQty: 5, newQty: 15, reference: "PO #po-1" });
    expect(fake.purchaseOrders.get("po-1")!.status).toBe("RECIBIDA");
  });

  it("409 si la orden ya fue recibida (no se puede recibir dos veces)", async () => {
    const fake = createFakePrisma({
      variants: [{ id: "v1", sku: "TQ-CAM-argentina-M", stock: 5 }],
      suppliers: [{ id: "sup-1", name: "IMAGO" }],
      purchaseOrders: [
        {
          id: "po-1",
          supplierId: "sup-1",
          status: "RECIBIDA",
          total: null,
          items: [{ id: "i1", variantSku: "TQ-CAM-argentina-M", quantity: 10, unitCost: null }],
        },
      ],
    });
    wire(fake);

    const res = await POST(req(), { params: { id: "po-1" } });
    expect(res.status).toBe(409);
    expect(fake.variants.get("v1")!.stock).toBe(5); // sin cambios
  });
});
