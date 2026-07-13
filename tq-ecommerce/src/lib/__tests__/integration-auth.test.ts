import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration-auth";

function req(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/integration/catalog", { headers });
}

describe("requireIntegrationApiKey", () => {
  const original = process.env.INTEGRATION_API_KEY;

  beforeEach(() => {
    delete process.env.INTEGRATION_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.INTEGRATION_API_KEY;
    else process.env.INTEGRATION_API_KEY = original;
  });

  it("responde 503 si INTEGRATION_API_KEY no está configurada", async () => {
    const res = requireIntegrationApiKey(req({ "x-api-key": "cualquiera" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });

  it("responde 401 si falta el header X-API-Key", async () => {
    process.env.INTEGRATION_API_KEY = "secreta";
    const res = requireIntegrationApiKey(req());
    expect(res!.status).toBe(401);
  });

  it("responde 401 si la key no coincide", async () => {
    process.env.INTEGRATION_API_KEY = "secreta";
    const res = requireIntegrationApiKey(req({ "x-api-key": "incorrecta" }));
    expect(res!.status).toBe(401);
  });

  it("permite continuar (null) si la key coincide", async () => {
    process.env.INTEGRATION_API_KEY = "secreta";
    const res = requireIntegrationApiKey(req({ "x-api-key": "secreta" }));
    expect(res).toBeNull();
  });
});
