import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakePrisma } from "@/test-utils/fake-prisma";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1", role: "ADMIN" } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productVariant: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    category: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    product: { findMany: vi.fn(), create: vi.fn() },
    supplier: { findFirst: vi.fn(), create: vi.fn() },
    purchaseOrder: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    stockMovement: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { POST, GET } from "./route";

function wire(fake: ReturnType<typeof createFakePrisma>) {
  (prisma.productVariant.findMany as any).mockImplementation(fake.prisma.productVariant.findMany);
  (prisma.productVariant.findFirst as any).mockImplementation(fake.prisma.productVariant.findFirst);
  (prisma.productVariant.findUnique as any).mockImplementation(fake.prisma.productVariant.findUnique);
  (prisma.productVariant.create as any).mockImplementation(fake.prisma.productVariant.create);
  (prisma.category.findFirst as any).mockImplementation(fake.prisma.category.findFirst);
  (prisma.category.findUnique as any).mockImplementation(fake.prisma.category.findUnique);
  (prisma.category.create as any).mockImplementation(fake.prisma.category.create);
  (prisma.product.findMany as any).mockImplementation(fake.prisma.product.findMany);
  (prisma.product.create as any).mockImplementation(fake.prisma.product.create);
  (prisma.supplier.findFirst as any).mockImplementation(fake.prisma.supplier.findFirst);
  (prisma.supplier.create as any).mockImplementation(fake.prisma.supplier.create);
  (prisma.purchaseOrder.findMany as any).mockImplementation(fake.prisma.purchaseOrder.findMany);
  (prisma.purchaseOrder.create as any).mockImplementation(fake.prisma.purchaseOrder.create);
  (prisma.$transaction as any).mockImplementation(fake.prisma.$transaction);
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/compras", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/compras", () => {
  let fake: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  });

  it("rechaza sin sesión", async () => {
    (auth as any).mockResolvedValueOnce(null);
    fake = createFakePrisma({});
    wire(fake);
    const res = await POST(postReq({ supplierName: "IMAGO", items: [] }));
    expect(res.status).toBe(401);
  });

  it("rechaza si hay códigos duplicados sin resolver", async () => {
    fake = createFakePrisma({});
    wire(fake);
    const res = await POST(
      postReq({
        supplierName: "IMAGO",
        items: [{ codigo: "6101", nombre: "NEGRA", categoria: "REMERAS", talla: "M", cantidad: 1, kind: "codigo-duplicado" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("crea producto y variante nuevos, y la orden pendiente", async () => {
    fake = createFakePrisma({});
    wire(fake);

    const res = await POST(
      postReq({
        supplierName: "IMAGO",
        items: [
          {
            codigo: "1001",
            nombre: "ARGENTINA AZUL",
            categoria: "CAMISETAS",
            talla: "M",
            cantidad: 5,
            kind: "producto-nuevo",
            proposedSku: "TQ-CAM-argentina-azul-M",
          },
        ],
      })
    );

    expect(res.status).toBe(201);
    expect(fake.products.size).toBe(1);
    const producto = [...fake.products.values()][0];
    expect(producto.supplierCode).toBe("1001");
    expect(fake.variants.size).toBe(1);
    expect(fake.purchaseOrders.size).toBe(1);
    const orden = [...fake.purchaseOrders.values()][0];
    expect(orden.items).toHaveLength(1);
    expect(orden.items[0].quantity).toBe(5);
    expect(orden.status).toBe("PENDIENTE");
  });

  it("una variante nueva de producto existente no duplica el producto", async () => {
    fake = createFakePrisma({
      products: [{ id: "prod-1", sku: "TQ-CAM-argentina-azul", name: "Argentina Azul", slug: "argentina-azul", supplierCode: "1001" }],
    });
    wire(fake);

    const res = await POST(
      postReq({
        supplierName: "IMAGO",
        items: [
          { codigo: "1001", nombre: "ARGENTINA AZUL", categoria: "CAMISETAS", talla: "M", cantidad: 2, kind: "variante-nueva", productId: "prod-1", proposedSku: "TQ-CAM-argentina-azul-M" },
          { codigo: "1001", nombre: "ARGENTINA AZUL", categoria: "CAMISETAS", talla: "L", cantidad: 3, kind: "variante-nueva", productId: "prod-1", proposedSku: "TQ-CAM-argentina-azul-L" },
        ],
      })
    );

    expect(res.status).toBe(201);
    expect(fake.products.size).toBe(1); // sin duplicar
    expect(fake.variants.size).toBe(2);
  });
});

describe("GET /api/admin/compras", () => {
  beforeEach(() => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  });

  it("lista órdenes con datos del proveedor", async () => {
    const fake = createFakePrisma({
      suppliers: [{ id: "sup-1", name: "IMAGO" }],
      purchaseOrders: [
        { id: "po-1", supplierId: "sup-1", status: "PENDIENTE", total: 1000, items: [{ id: "i1", variantSku: "SKU-1", quantity: 3, unitCost: null }] },
      ],
    });
    wire(fake);

    const res = await GET(new NextRequest("http://localhost/api/admin/compras"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ supplier: "IMAGO", status: "PENDIENTE", itemCount: 1, totalUnidades: 3 });
  });
});
