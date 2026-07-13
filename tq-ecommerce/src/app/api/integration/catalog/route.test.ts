import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

function getReq(q: string, apiKey = "secreta") {
  const url = q ? `http://localhost/api/integration/catalog?q=${encodeURIComponent(q)}` : "http://localhost/api/integration/catalog";
  return new NextRequest(url, { headers: { "x-api-key": apiKey } });
}

describe("GET /api/integration/catalog", () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_KEY = "secreta";
    (prisma.product.findMany as any).mockResolvedValue([
      {
        sku: "TQ-RUG-camiseta",
        name: "Camiseta Rugby",
        variants: [
          { sku: "TQ-RUG-camiseta-M", size: "M", color: "Azul", price: 15000, stock: 4, stockAlert: 2 },
        ],
      },
    ]);
  });

  it("rechaza sin API key", async () => {
    const res = await GET(getReq("camiseta", "mala"));
    expect(res.status).toBe(401);
  });

  it("devuelve el catálogo keyed por SKU", async () => {
    const res = await GET(getReq("camiseta"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products[0]).toMatchObject({
      sku: "TQ-RUG-camiseta",
      nombre: "Camiseta Rugby",
      variantes: [{ sku: "TQ-RUG-camiseta-M", talla: "M", stock: 4 }],
    });
  });
});
