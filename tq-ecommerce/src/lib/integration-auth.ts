import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Autenticación por API key para /api/integration/* (consumida por el POS
 * Flask, que no puede usar sesiones NextAuth). Devuelve una NextResponse de
 * error si el request debe rechazarse, o null si puede continuar.
 *
 * - Sin INTEGRATION_API_KEY configurada → 503 (integración deshabilitada,
 *   nunca acceso abierto por defecto).
 * - Header X-API-Key ausente o no coincide → 401.
 */
export function requireIntegrationApiKey(req: NextRequest): NextResponse | null {
  const configuredKey = process.env.INTEGRATION_API_KEY;
  if (!configuredKey) {
    return NextResponse.json({ error: "Integración deshabilitada" }, { status: 503 });
  }

  const providedKey = req.headers.get("x-api-key");
  if (!providedKey || !safeEqual(providedKey, configuredKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
