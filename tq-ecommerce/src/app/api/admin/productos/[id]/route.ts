import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const variantSchema = z.object({
  id: z.string().optional(), // existing variant
  sku: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  price: z.number().min(0),
  costPrice: z.number().min(0).optional(),
  barcode: z.string().optional(),
  stock: z.number().int().min(0),
  stockAlert: z.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
});

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  supplierCode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  gender: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  variants: z.array(variantSchema).optional(),
});

// GET: product detail for editing
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      variants: { orderBy: { createdAt: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...product,
    variants: product.variants.map((v) => ({
      ...v,
      price: Number(v.price),
      costPrice: v.costPrice ? Number(v.costPrice) : undefined,
    })),
  });
}

// PATCH: update product and variants
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { variants, ...productData } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: params.id }, data: productData });

    if (variants) {
      const existing = await tx.productVariant.findMany({
        where: { productId: params.id },
        select: { id: true, stock: true },
      });
      const existingIds = new Set(existing.map((v) => v.id));
      const incomingIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));

      // Delete removed variants
      const toDelete = existing.filter((v) => !incomingIds.has(v.id));
      if (toDelete.length) {
        await tx.productVariant.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } });
      }

      // Upsert variants
      for (const v of variants) {
        if (v.id && existingIds.has(v.id)) {
          const prev = existing.find((e) => e.id === v.id)!;
          await tx.productVariant.update({
            where: { id: v.id },
            data: { sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex, price: v.price, costPrice: v.costPrice, barcode: v.barcode, stock: v.stock, stockAlert: v.stockAlert, isActive: v.isActive },
          });
          if (v.stock !== prev.stock) {
            await tx.stockMovement.create({
              data: {
                variantId: v.id,
                type: "AJUSTE",
                quantity: Math.abs(v.stock - prev.stock),
                previousQty: prev.stock,
                newQty: v.stock,
                reason: "Ajuste desde edición de producto",
              },
            });
          }
        } else {
          // New variant
          const created = await tx.productVariant.create({
            data: { productId: params.id, sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex, price: v.price, costPrice: v.costPrice, barcode: v.barcode, stock: v.stock, stockAlert: v.stockAlert },
          });
          if (v.stock > 0) {
            await tx.stockMovement.create({
              data: { variantId: created.id, type: "ENTRADA", quantity: v.stock, previousQty: 0, newQty: v.stock, reason: "Stock inicial variante nueva" },
            });
          }
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}

// DELETE: soft delete (set isActive = false)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.product.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
