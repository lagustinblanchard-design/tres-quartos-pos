import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const variantSchema = z.object({
  sku: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  price: z.number().min(0),
  costPrice: z.number().min(0).optional(),
  barcode: z.string().optional(),
  stock: z.number().int().min(0).default(0),
  stockAlert: z.number().int().min(0).default(5),
});

const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  sku: z.string().min(1),
  supplierCode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().min(1),
  brandId: z.string().optional(),
  gender: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  variants: z.array(variantSchema).min(1, "Debe tener al menos una variante"),
});

// GET: list products
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? "";

  const products = await prisma.product.findMany({
    where: {
      ...(q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ]} : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      category: { select: { name: true } },
      brand: { select: { name: true } },
      variants: { select: { id: true, stock: true, price: true, isActive: true } },
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
    },
  });

  return NextResponse.json(products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    category: p.category.name,
    brand: p.brand?.name ?? null,
    variantCount: p.variants.length,
    totalStock: p.variants.reduce((a, v) => a + v.stock, 0),
    minPrice: Math.min(...p.variants.map((v) => Number(v.price))),
    image: p.images[0]?.url ?? null,
    updatedAt: p.updatedAt.toISOString(),
  })));
}

// POST: create product with variants
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { variants, ...productData } = parsed.data;

  // Check slug uniqueness
  const existingSlug = await prisma.product.findUnique({ where: { slug: productData.slug } });
  if (existingSlug) {
    return NextResponse.json({ error: { slug: ["Este slug ya existe"] } }, { status: 409 });
  }

  const existingSku = await prisma.product.findUnique({ where: { sku: productData.sku } });
  if (existingSku) {
    return NextResponse.json({ error: { sku: ["Este SKU ya existe"] } }, { status: 409 });
  }

  if (productData.supplierCode) {
    const existingSupplierCode = await prisma.product.findUnique({ where: { supplierCode: productData.supplierCode } });
    if (existingSupplierCode) {
      return NextResponse.json({ error: { supplierCode: ["Este código de proveedor ya está asignado a otro producto"] } }, { status: 409 });
    }
  }

  const product = await prisma.product.create({
    data: {
      ...productData,
      variants: {
        create: variants.map((v) => ({
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          price: v.price,
          costPrice: v.costPrice,
          barcode: v.barcode,
          stock: v.stock,
          stockAlert: v.stockAlert,
        })),
      },
    },
    select: { id: true, slug: true },
  });

  // Register stock movements for initial stock
  const createdVariants = await prisma.productVariant.findMany({
    where: { productId: product.id, stock: { gt: 0 } },
    select: { id: true, stock: true },
  });

  if (createdVariants.length > 0) {
    await prisma.stockMovement.createMany({
      data: createdVariants.map((v) => ({
        variantId: v.id,
        type: "ENTRADA" as const,
        quantity: v.stock,
        previousQty: 0,
        newQty: v.stock,
        reason: "Stock inicial al crear producto",
      })),
    });
  }

  return NextResponse.json(product, { status: 201 });
}
