import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockMovement: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

function getReq(reference: string, apiKey = "secreta") {
  const url = reference
    ? `http://localhost/api/integration/movements?reference=${encodeURIComponent(reference)}`
    : "http://localhost/api/integration/movements";
  return new NextRequest(url, { headers: { "x-api-key": apiKey } });
}

describe("GET /api/integration/movements", () => {
  beforeEach(() => {
    process.env.INTEGRATION_API_KEY = "secreta";
    (prisma.stockMovement.findMany as any).mockResolvedValue([
      {
        reference: "FLASK-POS #841",
        type: "VENTA",
        quantity: 2,
        variantId: "v1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
  });

  it("rechaza sin API key", async () => {
    const res = await GET(getReq("FLASK-POS", "mala"));
    expect(res.status).toBe(401);
  });

  it("filtra por prefijo de referencia", async () => {
    const res = await GET(getReq("FLASK-POS"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.movements[0]).toMatchObject({ reference: "FLASK-POS #841", quantity: 2 });
    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: { startsWith: "FLASK-POS" } } })
    );
  });
});
