"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Edit, Eye, Package, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  isActive: boolean;
  isFeatured: boolean;
  category: string;
  brand: string | null;
  variantCount: number;
  totalStock: number;
  minPrice: number;
  image: string | null;
  updatedAt: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

export function ProductsTable({
  products,
  categories,
}: {
  products: Product[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k); });
    router.push(`${pathname}?${sp.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: search });
  }

  async function toggleActive(id: string, current: boolean) {
    setTogglingId(id);
    await fetch(`/api/admin/productos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    setTogglingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o SKU..." className="pl-9" />
          </div>
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>
        <select
          className="rounded-md border text-sm px-3 py-2 bg-white"
          value={searchParams.get("cat") ?? ""}
          onChange={(e) => navigate({ cat: e.target.value })}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {products.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay productos que coincidan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-right">Variantes</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Precio desde</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {p.image
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                            : <Package className="h-5 w-5 text-gray-400" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[180px]">
                            {p.isFeatured && <Star className="inline h-3 w-3 text-amber-400 mr-1" />}
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-400">{p.brand ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 text-gray-600">{p.category}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.variantCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={
                        p.totalStock === 0 ? "text-red-600 font-semibold" :
                        p.totalStock <= 5 ? "text-amber-600 font-semibold" : "text-gray-700"
                      }>
                        {p.totalStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(p.minPrice)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        disabled={togglingId === p.id}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          p.isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {togglingId === p.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        {p.isActive ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild title="Ver en tienda">
                          <Link href={`/catalogo/${p.slug}`} target="_blank"><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild title="Editar">
                          <Link href={`/admin/productos/${p.id}`}><Edit className="h-4 w-4" /></Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
