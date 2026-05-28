import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Validate by magic bytes — cannot be faked by changing Content-Type
const IMAGE_SIGNATURES: { bytes: number[]; mime: string }[] = [
  { bytes: [0xff, 0xd8, 0xff],                   mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], mime: "image/png"  },
  { bytes: [0x47, 0x49, 0x46, 0x38],              mime: "image/gif"  },
  { bytes: [0x52, 0x49, 0x46, 0x46],              mime: "image/webp" }, // RIFF header (WebP)
];

function detectImageMime(buffer: Uint8Array): string | null {
  for (const sig of IMAGE_SIGNATURES) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) return sig.mime;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 10 MB" }, { status: 400 });
  }

  // Read first 12 bytes to detect real file type
  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const mime = detectImageMime(headerBytes);

  if (!mime) {
    return NextResponse.json({ error: "Solo se permiten imágenes (JPG, PNG, WebP, GIF)" }, { status: 400 });
  }

  // Sanitize filename — strip path traversal and keep only safe chars
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);

  try {
    const blob = await put(`diseno/${Date.now()}-${safeName}`, file, {
      access: "public",
      contentType: mime,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("Blob upload error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
