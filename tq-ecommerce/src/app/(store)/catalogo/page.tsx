import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Grid3X3, List } from "lucide-react";

// En prod: fetch desde /api/products con searchParams
const products = [
  { id: "1", name: "Remera Training Pro", slug: "remera-training-pro", price: 12990, originalPrice: 16990, image: "👕", category: "Remeras", isNew: true, isSale: true, rating: 4.8, reviews: 24 },
  { id: "2", name: "Pantalón Cargo Sport", slug: "pantalon-cargo-sport", price: 24990, originalPrice: null, image: "👖", category: "Pantalones", isNew: false, isSale: false, rating: 4.5, reviews: 12 },
  { id: "3", name: "Calzado Running X200", slug: "calzado-running-x200", price: 45990, originalPrice: 55990, image: "👟", category: "Calzado", isNew: true, isSale: true, rating: 5.0, reviews: 38 },
  { id: "4", name: "Buzo Hoodie Classic", slug: "buzo-hoodie-classic", price: 32990, originalPrice: null, image: "🧥", category: "Buzos", isNew: false, isSale: false, rating: 4.3, reviews: 8 },
  { id: "5", name: "Medias Running Pack x3", slug: "medias-running-pack", price: 4990, originalPrice: null, image: "🧦", category: "Accesorios", isNew: false, isSale: false, rating: 4.6, reviews: 51 },
  { id: "6", name: "Cinta Deportiva Elástica", slug: "cinta-deportiva", price: 2990, originalPrice: 3990, image: "🎽", category: "Accesorios", isNew: false, isSale: true, rating: 4.1, reviews: 15 },
];

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

export const metadata = {
  title: "Catálogo",
  description: "Explorá toda nuestra ropa deportiva",
};

export default function CatalogoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="w-full md:w-56 shrink-0">
          <h2 className="font-semibold mb-4">Filtros</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-3">Categoría</h3>
              <div className="space-y-2">
                {["Remeras", "Pantalones", "Calzado", "Buzos", "Accesorios"].map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                    <input type="checkbox" className="rounded" />
                    {cat}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Talle</h3>
              <div className="flex flex-wrap gap-2">
                {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                  <button key={s} className="rounded border px-2.5 py-1 text-xs hover:border-blue-500 hover:text-blue-600 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Género</h3>
              <div className="space-y-2">
                {["Hombre", "Mujer", "Unisex", "Niño"].map((g) => (
                  <label key={g} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                    <input type="checkbox" className="rounded" />
                    {g}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Precio</h3>
              <div className="space-y-2">
                <input type="range" min="0" max="100000" className="w-full" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>$0</span>
                  <span>$100.000</span>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" className="rounded" />
                Solo en oferta
              </label>
            </div>

            <Button variant="outline" className="w-full" size="sm">Limpiar filtros</Button>
          </div>
        </aside>

        {/* Products */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Catálogo</h1>
              <p className="text-gray-500 text-sm">{products.length} productos</p>
            </div>
            <div className="flex items-center gap-3">
              <select className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option>Más populares</option>
                <option>Precio: menor a mayor</option>
                <option>Precio: mayor a menor</option>
                <option>Más nuevos</option>
              </select>
              <div className="flex border rounded-md overflow-hidden">
                <button className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button className="p-2 hover:bg-gray-50 transition-colors">
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {products.map((p) => (
              <Link key={p.id} href={`/catalogo/${p.slug}`}>
                <Card className="group overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="relative aspect-square bg-gray-50 flex items-center justify-center text-6xl">
                    {p.image}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {p.isNew && <Badge variant="default" className="text-xs">Nuevo</Badge>}
                      {p.isSale && <Badge variant="destructive" className="text-xs">Oferta</Badge>}
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400 mb-1">{p.category}</p>
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-400 text-xs">★</span>
                      <span className="text-xs text-gray-500">{p.rating} ({p.reviews})</span>
                    </div>
                    <div className="mt-2">
                      <span className="font-bold text-blue-600">{formatPrice(p.price)}</span>
                      {p.originalPrice && (
                        <span className="ml-2 text-xs text-gray-400 line-through">
                          {formatPrice(p.originalPrice)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-8">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button size="sm">1</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button variant="outline" size="sm">3</Button>
            <Button variant="outline" size="sm">Siguiente</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
