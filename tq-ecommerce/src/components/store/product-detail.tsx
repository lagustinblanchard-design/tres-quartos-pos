"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart-context";
import {
  ShoppingCart,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Star,
  Truck,
  RotateCcw,
  Shield,
  Minus,
  Plus,
  Check,
  AlertTriangle,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

type Variant = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  price: number;
  costPrice: number | null;
  stock: number;
  stockAlert: number;
  barcode: string | null;
  isActive: boolean;
};

type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: { name: string | null; image: string | null };
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string;
  gender: string | null;
  isFeatured: boolean;
  tags: string[];
  images: ProductImage[];
  variants: Variant[];
  reviews: Review[];
  avgRating: number;
  category: { name: string; slug: string };
  brand: { name: string } | null;
};

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const s = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${s} ${star <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

export function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();

  // Imágenes: si no hay en DB, usamos placeholder
  const images = product.images.length > 0
    ? product.images
    : [{ id: "ph", url: "", alt: product.name, position: 0 }];

  const [activeImg, setActiveImg] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<"desc" | "reviews" | "envio">("desc");

  // Colores únicos disponibles
  const colors = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))) as string[],
    [product.variants]
  );

  // Talles disponibles para el color seleccionado (o todos si no hay color)
  const sizes = useMemo(() => {
    const base = selectedColor
      ? product.variants.filter((v) => v.color === selectedColor)
      : product.variants;
    return Array.from(new Set(base.map((v) => v.size).filter(Boolean))) as string[];
  }, [product.variants, selectedColor]);

  // Variante actualmente seleccionada
  const selectedVariant = useMemo(
    () =>
      product.variants.find(
        (v) =>
          (colors.length === 0 || v.color === selectedColor || selectedColor === null) &&
          (sizes.length === 0 || v.size === selectedSize || selectedSize === null) &&
          (selectedColor !== null || selectedSize !== null
            ? (selectedColor === null || v.color === selectedColor) &&
              (selectedSize === null || v.size === selectedSize)
            : false)
      ) ?? null,
    [product.variants, selectedColor, selectedSize, colors.length, sizes.length]
  );

  // Si solo hay 1 variante, usarla directamente
  const activeVariant = product.variants.length === 1 ? product.variants[0] : selectedVariant;

  const price = activeVariant?.price ?? Math.min(...product.variants.map((v) => v.price));
  const maxPrice = Math.max(...product.variants.map((v) => v.price));
  const hasRange = price !== maxPrice && !activeVariant;

  const inStock = activeVariant ? activeVariant.stock > 0 : product.variants.some((v) => v.stock > 0);
  const lowStock = activeVariant && activeVariant.stock > 0 && activeVariant.stock <= activeVariant.stockAlert;
  const maxQty = activeVariant?.stock ?? 10;

  function handleAddToCart() {
    if (!activeVariant) return;
    addItem({
      variantId: activeVariant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      size: activeVariant.size,
      color: activeVariant.color,
      price: activeVariant.price,
      stock: activeVariant.stock,
      image: images[0]?.url,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  }

  const needsSelection = (colors.length > 1 && !selectedColor) || (sizes.length > 1 && !selectedSize);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">
      {/* ─── GALLERY ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Main image */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 select-none">
          {images[activeImg].url ? (
            <Image
              src={images[activeImg].url}
              alt={images[activeImg].alt ?? product.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-8xl">
              👕
            </div>
          )}

          {/* Nav arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {product.isFeatured && (
            <Badge className="absolute top-3 left-3">Destacado</Badge>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveImg(i)}
                className={`relative shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  activeImg === i ? "border-blue-500" : "border-transparent hover:border-gray-300"
                }`}
              >
                {img.url ? (
                  <Image src={img.url} alt={img.alt ?? ""} fill className="object-cover" sizes="64px" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-100 text-2xl">👕</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── PRODUCT INFO ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>{product.category.name}</span>
            {product.brand && <><span>·</span><span>{product.brand.name}</span></>}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">{product.name}</h1>

          {/* Rating */}
          {product.reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <StarRating rating={product.avgRating} />
              <span className="text-sm text-gray-500">
                {product.avgRating.toFixed(1)} ({product.reviews.length} reseñas)
              </span>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-blue-600">
            {hasRange ? `Desde ${formatPrice(price)}` : formatPrice(price)}
          </span>
        </div>

        {/* Stock status */}
        {activeVariant && (
          <div className="flex items-center gap-2 text-sm">
            {activeVariant.stock === 0 ? (
              <span className="flex items-center gap-1.5 text-red-500 font-medium">
                <AlertTriangle className="h-4 w-4" /> Sin stock
              </span>
            ) : lowStock ? (
              <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                <AlertTriangle className="h-4 w-4" /> Últimas {activeVariant.stock} unidades
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <Check className="h-4 w-4" /> En stock ({activeVariant.stock} disponibles)
              </span>
            )}
          </div>
        )}

        {/* Color selector */}
        {colors.length > 1 && (
          <div>
            <p className="text-sm font-semibold mb-2">
              Color:{" "}
              <span className="font-normal text-gray-600">{selectedColor ?? "Seleccioná"}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => {
                const variant = product.variants.find((v) => v.color === color);
                const hex = variant?.colorHex ?? "#999";
                const hasStock = product.variants.some((v) => v.color === color && v.stock > 0);
                return (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      setSelectedSize(null);
                      setQty(1);
                    }}
                    disabled={!hasStock}
                    title={color}
                    className={`relative h-9 w-9 rounded-full border-2 transition-all disabled:opacity-40 ${
                      selectedColor === color
                        ? "border-blue-500 ring-2 ring-blue-200 scale-110"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {!hasStock && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="block w-[110%] h-0.5 bg-gray-400 rotate-45 rounded" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size selector */}
        {sizes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">
                Talle:{" "}
                <span className="font-normal text-gray-600">{selectedSize ?? "Seleccioná"}</span>
              </p>
              <button className="text-xs text-blue-600 hover:underline">Guía de talles</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => {
                const variant = product.variants.find(
                  (v) => v.size === size && (!selectedColor || v.color === selectedColor)
                );
                const hasStock = variant ? variant.stock > 0 : false;
                return (
                  <button
                    key={size}
                    onClick={() => { setSelectedSize(size); setQty(1); }}
                    disabled={!hasStock}
                    className={`min-w-[2.75rem] rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedSize === size
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Qty + Add to cart */}
        <div className="flex flex-col gap-3 pt-2">
          {/* Quantity */}
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">Cantidad:</p>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-10 w-10 flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-40"
                disabled={qty <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="h-10 w-12 flex items-center justify-center font-semibold text-sm border-x">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="h-10 w-10 flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-40"
                disabled={qty >= maxQty || !activeVariant}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1"
              disabled={!inStock || needsSelection || !activeVariant}
              onClick={handleAddToCart}
            >
              {addedFeedback ? (
                <><Check className="h-5 w-5 mr-2" /> ¡Agregado!</>
              ) : (
                <><ShoppingCart className="h-5 w-5 mr-2" /> Agregar al carrito</>
              )}
            </Button>
            <Button size="lg" variant="outline" className="px-3">
              <Heart className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="px-3">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          {needsSelection && (
            <p className="text-sm text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              {!selectedColor && colors.length > 1 ? "Seleccioná un color" : "Seleccioná un talle"}
            </p>
          )}
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t">
          {[
            { icon: Truck, label: "Envío a todo el país" },
            { icon: RotateCcw, label: "30 días para cambios" },
            { icon: Shield, label: "Compra protegida" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                <Icon className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <span className="text-xs text-gray-500 leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* SKU */}
        {activeVariant && (
          <p className="text-xs text-gray-400">
            SKU: <span className="font-mono">{activeVariant.sku}</span>
            {activeVariant.barcode && <> · Código: <span className="font-mono">{activeVariant.barcode}</span></>}
          </p>
        )}
      </div>

      {/* ─── TABS (descripción / reseñas / envío) ────────────────────────── */}
      <div className="lg:col-span-2 mt-4">
        {/* Tab headers */}
        <div className="flex border-b">
          {(["desc", "reviews", "envio"] as const).map((tab) => {
            const labels = { desc: "Descripción", reviews: `Reseñas (${product.reviews.length})`, envio: "Envío y devoluciones" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="py-6">
          {activeTab === "desc" && (
            <div className="max-w-2xl">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {product.description ?? "Sin descripción disponible."}
              </p>
              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <ReviewsSection reviews={product.reviews} avgRating={product.avgRating} />
          )}

          {activeTab === "envio" && (
            <div className="max-w-2xl space-y-4 text-sm text-gray-700">
              <div className="flex gap-3">
                <Truck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Envío a todo el país</p>
                  <p>CABA y GBA: 1-3 días hábiles — $2.500 (gratis en compras +$50.000)</p>
                  <p>Interior: 3-7 días hábiles — $5.500 (gratis en compras +$50.000)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <RotateCcw className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Cambios y devoluciones</p>
                  <p>Tenés 30 días desde la recepción del producto. El artículo debe estar sin uso, con etiquetas y en su empaque original. El primer cambio de talla es sin cargo.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reviews section ──────────────────────────────────────────────────────────

function ReviewsSection({ reviews, avgRating }: { reviews: Review[]; avgRating: number }) {
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  if (reviews.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Aún no hay reseñas para este producto.</p>
        <p className="text-sm mt-1">Sé el primero en opinar.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Summary */}
      <div className="flex flex-col items-center justify-center gap-3">
        <span className="text-5xl font-bold">{avgRating.toFixed(1)}</span>
        <StarRating rating={avgRating} size="lg" />
        <span className="text-sm text-gray-500">{reviews.length} reseñas</span>
        <div className="w-full space-y-1.5 mt-2">
          {distribution.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-right text-gray-500">{star}</span>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full"
                  style={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : "0%" }}
                />
              </div>
              <span className="w-4 text-gray-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review list */}
      <div className="md:col-span-2 space-y-5">
        {reviews.map((review) => (
          <div key={review.id} className="border-b pb-5 last:border-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700">
                {review.user.name?.[0] ?? "?"}
              </div>
              <div>
                <p className="text-sm font-medium">{review.user.name ?? "Cliente"}</p>
                <p className="text-xs text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="ml-auto">
                <StarRating rating={review.rating} />
              </div>
            </div>
            {review.comment && (
              <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
