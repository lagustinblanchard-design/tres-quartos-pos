import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1", role: "ADMIN" } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { POST } from "./route";

function buildFakeXlsFile(): File {
  const rows: unknown[][] = [
    ["CUADRO PEDIDO"],
    ["CAMISETAS"],
    ["MODELOS", "CODIGO", "S", "M", "L"],
    ["ARGENTINA AZUL", 1001, "", 2, ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Hoja1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new File([buffer], "pedido.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("POST /api/admin/compras/preview", () => {
  beforeEach(() => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.product.findMany as any).mockResolvedValue([]);
  });

  it("rechaza sin sesión", async () => {
    (auth as any).mockResolvedValueOnce(null);
    const form = new FormData();
    form.set("file", buildFakeXlsFile());
    const res = await POST(new NextRequest("http://localhost/api/admin/compras/preview", { method: "POST", body: form }));
    expect(res.status).toBe(401);
  });

  it("rechaza si falta el archivo", async () => {
    const form = new FormData();
    const res = await POST(new NextRequest("http://localhost/api/admin/compras/preview", { method: "POST", body: form }));
    expect(res.status).toBe(400);
  });

  it("parsea el archivo y devuelve el plan con productos nuevos", async () => {
    const form = new FormData();
    form.set("file", buildFakeXlsFile());
    const res = await POST(new NextRequest("http://localhost/api/admin/compras/preview", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ codigo: "1001", talla: "M", cantidad: 2, kind: "producto-nuevo" });
    expect(body.resumen.productoNuevo).toBe(1);
  });
});
