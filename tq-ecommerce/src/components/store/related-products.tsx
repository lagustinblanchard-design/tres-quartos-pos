import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

type RelatedProduct = {
  id: string;
  name: string;
  slug: string;
  images: { url: string; alt: string | null }[];
  variants: { price: number }[];
};

export function RelatedProducts({ products }: { products: RelatedProduct[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {products.map((p) => {
        const minPrice = Math.min(...p.variants.map((v) => v.price));
        const image = p.images[0];
        return (
          <Link key={p.id} href={`/catalogo/${p.slug}`}>
            <Card className="group overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
              <div className="relative aspect-square bg-gray-100 overflow-hidden">
                {image?.url ? (
                  <Image
                    src={image.url}
                    alt={image.alt ?? p.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl">👕</div>
                )}
              </div>
              <CardContent className="p-3">
                <h3 className="text-sm font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {p.name}
                </h3>
                <p className="text-sm font-bold text-blue-600 mt-1">
                  {p.variants.length > 1 ? `Desde ` : ""}{formatPrice(minPrice)}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
