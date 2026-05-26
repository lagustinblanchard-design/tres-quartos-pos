"use client";

import { useState, useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StockAdjustModal } from "@/components/admin/stock-adjust-modal";
import {
  Search,
  SlidersHorizontal,
  PackagePlus,
  AlertTriangle,
  PackageX,
  Package,
  Loader2,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

type ProductImage = { url: string; alt: string | null };
type Category = { id: string; name: string };

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
  product: {
    id: string;
    name: string;
    sku: string;
    slug: string;
    category: { id: string; name: string };
    brand: { name: string } | null;
    images: ProductImage[];
  };
};

type Props = {
  initialVariants: Variant[];
  categories: Category[];
};

type StatusFilter = "all" | "out" | "critical" | "ok";

const STATUS_TABS: { id: StatusFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "Todos", icon: <Package className="h-3.5 w-3.5" /> },
  { id: "critical", label: "Stock crítico", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: "out", label: "Sin stock", icon: <PackageX className="h-3.5 w-3.5" /> },
  { id: "ok", label: "En stock", icon: <Package className="h-3.5 w-3.5" /> },
];

function stockBadge(stock: number, alert: number) {
  if (stock === 0)
    return <Badge variant="destructive" className="text-xs">Sin stock</Badge>;
  if (stock <= alert)
    return <Badge variant="warning" className="text-xs bg-amber-100 text-amber-800 border-amber-200">Crítico ({stock})</Badge>;
  return <Badge variant="success" className="text-xs">{stock} u.</Badge>;
}

export function StockTable({ initialVariants, categories }: Props) {
  const [variants, setVariants] = useState<Variant[]>(initialVariants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [adjustingVariant, setAdjustingVariant] = useState<Variant | null>(null);
  const [isPending] = useTransition();

  // Filtrado local (rápido, sin red)
  const filtered = variants.filter((v) => {
    const matchSearch =
      !search ||
      v.product.name.toLowerCase().includes(search.toLowerCase()) ||
      v.sku.toLowerCase().includes(search.toLowerCase()) ||
      (v.barcode ?? "").includes(search) ||
      (v.color ?? "").toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "out" && v.stock === 0) ||
      (statusFilter === "critical" && v.stock > 0 && v.stock <= v.stockAlert) ||
      (statusFilter === "ok" && v.stock > v.stockAlert);

    const matchCategory = !categoryFilter || v.product.category.id === categoryFilter;

    return matchSearch && matchStatus && matchCategory;
  });

  // Counts para los tabs
  const counts = {
    all: variants.length,
    out: variants.filter((v) => v.stock === 0).length,
    critical: variants.filter((v) => v.stock > 0 && v.stock <= v.stockAlert).length,
    ok: variants.filter((v) => v.stock > v.stockAlert).length,
  };

  const handleAdjustSuccess = useCallback((variantId: string, newStock: number) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, stock: newStock } : v))
    );
  }, []);

  return (
    <>
      <Card>
        {/* Filters */}
        <CardContent className="p-4 border-b space-y-3">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-60 rounded-md border bg-white px-3 py-2">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="search"
                placeholder="Buscar por producto, SKU, código de barras..."
                className="flex-1 text-sm outline-none bg-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>
            {/* Category */}
            <select
              className="rounded-md border px-3 py-2 text-sm bg-white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearch(""); setCategoryFilter(""); setStatusFilter("all"); }}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          </div>

          {/* Status tabs */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === tab.id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  statusFilter === tab.id ? "bg-blue-200 text-blue-800" : "bg-gray-100 text-gray-500"
                }`}>
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </CardContent>

        {/* Table */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left">
                <tr>
                  <th className="p-4 font-medium text-gray-500">Producto</th>
                  <th className="p-4 font-medium text-gray-500">Variante</th>
                  <th className="p-4 font-medium text-gray-500">SKU / Barcode</th>
                  <th className="p-4 font-medium text-gray-500 text-right">Precio</th>
                  <th className="p-4 font-medium text-gray-500 text-center">Stock</th>
                  <th className="p-4 font-medium text-gray-500 text-center">Alerta</th>
                  <th className="p-4 font-medium text-gray-500 text-center">Estado</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-gray-400">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      No se encontraron variantes con los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => (
                    <tr
                      key={v.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        v.stock === 0
                          ? "bg-red-50/40"
                          : v.stock <= v.stockAlert
                          ? "bg-amber-50/40"
                          : ""
                      }`}
                    >
                      {/* Product */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                            {v.product.images[0]?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.product.images[0].url}
                                alt={v.product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              "👕"
                            )}
                          </div>
                          <div>
                            <p className="font-medium leading-tight">{v.product.name}</p>
                            <p className="text-xs text-gray-400">
                              {v.product.brand?.name ?? v.product.category.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Variant */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {v.colorHex && (
                            <span
                              className="h-4 w-4 rounded-full border border-gray-200 shrink-0"
                              style={{ backgroundColor: v.colorHex }}
                            />
                          )}
                          <span className="text-gray-700">
                            {[v.color, v.size].filter(Boolean).join(" / ") || "—"}
                          </span>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-4">
                        <p className="font-mono text-xs text-gray-600">{v.sku}</p>
                        {v.barcode && (
                          <p className="font-mono text-xs text-gray-400">{v.barcode}</p>
                        )}
                      </td>

                      {/* Price */}
                      <td className="p-4 text-right">
                        <p className="font-semibold">{formatPrice(v.price)}</p>
                        {v.costPrice && (
                          <p className="text-xs text-gray-400">Costo: {formatPrice(v.costPrice)}</p>
                        )}
                      </td>

                      {/* Stock — editable inline */}
                      <td className="p-4 text-center">
                        <span
                          className={`text-2xl font-bold ${
                            v.stock === 0
                              ? "text-red-500"
                              : v.stock <= v.stockAlert
                              ? "text-amber-500"
                              : "text-gray-800"
                          }`}
                        >
                          {v.stock}
                        </span>
                      </td>

                      {/* Alert threshold */}
                      <td className="p-4 text-center text-gray-400 text-sm">{v.stockAlert}</td>

                      {/* Status badge */}
                      <td className="p-4 text-center">{stockBadge(v.stock, v.stockAlert)}</td>

                      {/* Actions */}
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjustingVariant(v)}
                          className="whitespace-nowrap"
                        >
                          <PackagePlus className="h-3.5 w-3.5 mr-1" />
                          Ajustar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="border-t px-4 py-3 text-xs text-gray-400">
              Mostrando {filtered.length} de {variants.length} variantes
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust modal */}
      {adjustingVariant && (
        <StockAdjustModal
          variant={adjustingVariant}
          onClose={() => setAdjustingVariant(null)}
          onSuccess={handleAdjustSuccess}
        />
      )}
    </>
  );
}
