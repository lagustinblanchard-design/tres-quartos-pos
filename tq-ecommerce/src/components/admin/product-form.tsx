"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, "SKU requerido"),
  size: z.string().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  price: z.number().min(1, "Precio requerido"),
  costPrice: z.number().min(0).optional(),
  barcode: z.string().optional(),
  stock: z.number().int().min(0),
  stockAlert: z.number().int().min(0),
  isActive: z.boolean(),
});

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  sku: z.string().min(1, "SKU requerido"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Categoría requerida"),
  brandId: z.string().optional(),
  gender: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  tags: z.string().optional(),
  variants: z.array(variantSchema).min(1, "Agregá al menos una variante"),
});

type FormData = z.infer<typeof schema>;

type Category = { id: string; name: string };
type Brand = { id: string; name: string };

type ProductData = {
  id?: string;
  name?: string;
  slug?: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  gender?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  variants?: Array<{
    id?: string;
    sku: string;
    size?: string | null;
    color?: string | null;
    colorHex?: string | null;
    price: number;
    costPrice?: number | null;
    barcode?: string | null;
    stock: number;
    stockAlert: number;
    isActive?: boolean;
  }>;
};

export function ProductForm({
  product,
  categories,
  brands,
}: {
  product?: ProductData;
  categories: Category[];
  brands: Brand[];
}) {
  const router = useRouter();
  const isEdit = !!product?.id;
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedVariant, setExpandedVariant] = useState<number | null>(0);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      sku: product?.sku ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? "",
      brandId: product?.brandId ?? "",
      gender: product?.gender ?? "",
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      tags: product?.tags?.join(", ") ?? "",
      variants: product?.variants?.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size ?? "",
        color: v.color ?? "",
        colorHex: v.colorHex ?? "",
        price: v.price,
        costPrice: v.costPrice ?? undefined,
        barcode: v.barcode ?? "",
        stock: v.stock,
        stockAlert: v.stockAlert,
        isActive: v.isActive ?? true,
      })) ?? [{ sku: "", size: "", color: "", colorHex: "", price: 0, stock: 0, stockAlert: 5, isActive: true }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  // Auto-generate slug from name
  const nameVal = watch("name");
  function autoSlug() {
    if (!isEdit) {
      const slug = nameVal
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      setValue("slug", slug);
    }
  }

  async function onSubmit(data: FormData) {
    setStatus("loading");
    setErrorMsg("");

    const tagsArray = data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const payload = {
      ...data,
      tags: tagsArray,
      brandId: data.brandId || undefined,
      gender: data.gender || undefined,
    };

    const url = isEdit ? `/api/admin/productos/${product!.id}` : "/api/admin/productos";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      const first = Object.values(body.error ?? {})[0];
      setErrorMsg(Array.isArray(first) ? first[0] : (body.error ?? "Error al guardar"));
      setStatus("error");
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/admin/productos"), 800);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-3xl">
      {/* Feedback */}
      {status === "success" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Guardado correctamente. Redirigiendo...
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* General info */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-800">Información general</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Nombre del producto *</label>
            <Input {...register("name")} onBlur={autoSlug} placeholder="Remera Training Pro" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Slug (URL) *</label>
            <Input {...register("slug")} placeholder="remera-training-pro" />
            {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">SKU del producto *</label>
            <Input {...register("sku")} placeholder="REM-001" />
            {errors.sku && <p className="text-xs text-red-500">{errors.sku.message}</p>}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Descripción</label>
            <textarea
              {...register("description")}
              rows={4}
              placeholder="Describe el producto..."
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoría *</label>
            <select {...register("categoryId")} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
              <option value="">Seleccionar...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Marca</label>
            <select {...register("brandId")} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
              <option value="">Sin marca</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Género</label>
            <select {...register("gender")} className="w-full rounded-md border px-3 py-2 text-sm bg-white">
              <option value="">Todos</option>
              <option value="HOMBRE">Hombre</option>
              <option value="MUJER">Mujer</option>
              <option value="UNISEX">Unisex</option>
              <option value="NINOS">Niños</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tags (separados por coma)</label>
            <Input {...register("tags")} placeholder="deporte, running, verano" />
          </div>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("isActive")} className="rounded" />
              Producto activo (visible en tienda)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("isFeatured")} className="rounded" />
              Destacado (aparece en home)
            </label>
          </div>
        </div>
      </section>

      {/* Variants */}
      <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Variantes ({fields.length})</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              append({ sku: "", size: "", color: "", colorHex: "", price: 0, stock: 0, stockAlert: 5, isActive: true });
              setExpandedVariant(fields.length);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Agregar variante
          </Button>
        </div>

        {errors.variants && !Array.isArray(errors.variants) && (
          <p className="px-6 pt-3 text-xs text-red-500">{errors.variants.message}</p>
        )}

        <div className="divide-y">
          {fields.map((field, i) => {
            const isExpanded = expandedVariant === i;
            const variantErrors = Array.isArray(errors.variants) ? errors.variants[i] : undefined;
            return (
              <div key={field.id}>
                {/* Variant header */}
                <button
                  type="button"
                  onClick={() => setExpandedVariant(isExpanded ? null : i)}
                  className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                  <span className="flex-1 text-sm font-medium">
                    {watch(`variants.${i}.sku`) || `Variante ${i + 1}`}
                    {watch(`variants.${i}.color`) ? ` · ${watch(`variants.${i}.color`)}` : ""}
                    {watch(`variants.${i}.size`) ? ` · T. ${watch(`variants.${i}.size`)}` : ""}
                  </span>
                  <span className="text-xs text-gray-400">Stock: {watch(`variants.${i}.stock`) ?? 0}</span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); remove(i); }}
                      className="ml-2 text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </button>

                {/* Variant fields */}
                {isExpanded && (
                  <div className="px-6 pb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 bg-gray-50">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">SKU *</label>
                      <Input {...register(`variants.${i}.sku`)} placeholder="REM-001-M-N" className="h-8 text-sm" />
                      {variantErrors?.sku && <p className="text-xs text-red-500">{variantErrors.sku.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Talle</label>
                      <Input {...register(`variants.${i}.size`)} placeholder="M / 42 / XL" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Color</label>
                      <Input {...register(`variants.${i}.color`)} placeholder="Negro" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Hex color</label>
                      <div className="flex items-center gap-2">
                        <Input {...register(`variants.${i}.colorHex`)} placeholder="#000000" className="h-8 text-sm" />
                        <input type="color" value={watch(`variants.${i}.colorHex`) || "#000000"} onChange={(e) => setValue(`variants.${i}.colorHex`, e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Precio venta *</label>
                      <Input {...register(`variants.${i}.price`)} type="number" min="0" step="1" className="h-8 text-sm" />
                      {variantErrors?.price && <p className="text-xs text-red-500">{variantErrors.price.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Precio costo</label>
                      <Input {...register(`variants.${i}.costPrice`)} type="number" min="0" step="1" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Stock</label>
                      <Input {...register(`variants.${i}.stock`)} type="number" min="0" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Alerta stock</label>
                      <Input {...register(`variants.${i}.stockAlert`)} type="number" min="0" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Código de barras</label>
                      <Input {...register(`variants.${i}.barcode`)} placeholder="7891234567890" className="h-8 text-sm" />
                    </div>
                    <div className="col-span-full flex items-center gap-2 pt-1">
                      <input type="checkbox" {...register(`variants.${i}.isActive`)} id={`active-${i}`} className="rounded" />
                      <label htmlFor={`active-${i}`} className="text-xs text-gray-600 cursor-pointer">Variante activa</label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "loading" || status === "success"} size="lg">
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEdit ? "Guardar cambios" : "Crear producto"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push("/admin/productos")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
