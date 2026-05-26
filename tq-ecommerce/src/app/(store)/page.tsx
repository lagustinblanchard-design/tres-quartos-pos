export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, Shield, RotateCcw, MessageCircle } from "lucide-react";

const categories = [
  { name: "Rugby", slug: "rugby", emoji: "🏉", desc: "Botines, camisetas, protecciones" },
  { name: "Fútbol", slug: "futbol", emoji: "⚽", desc: "Botines, camisetas, medias" },
  { name: "Running", slug: "running", emoji: "👟", desc: "Zapatillas, ropa técnica" },
  { name: "Accesorios", slug: "accesorios", emoji: "🎽", desc: "Medias, vendas, botiquín" },
];

const benefits = [
  { icon: Truck, title: "Envío gratis", desc: "En compras mayores a $50.000" },
  { icon: Shield, title: "Compra segura", desc: "Pago protegido con MercadoPago" },
  { icon: RotateCcw, title: "Cambios gratis", desc: "Hasta 30 días sin cargo" },
  { icon: MessageCircle, title: "Soporte", desc: "Atención por WhatsApp y email" },
];

const values = [
  { label: "Comunidad", desc: "Somos parte del deporte, no solo un negocio" },
  { label: "Honestidad", desc: "Artículos descritos tal cual son" },
  { label: "Accesibilidad", desc: "El deporte para todos los bolsillos" },
  { label: "Pasión", desc: "Amamos el deporte. Se nota." },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero — Carbón TQ con acento amarillo */}
      <section className="relative bg-[#3A3A3A] text-white overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: "repeating-linear-gradient(45deg, #F5C200 0px, #F5C200 1px, transparent 0px, transparent 50%)",
            backgroundSize: "20px 20px",
          }} />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F5C200]/20 border border-[#F5C200]/40 px-4 py-1.5 mb-6">
              <span className="text-[#F5C200] text-xs font-barlow font-semibold uppercase tracking-widest">
                Nueva colección 2026
              </span>
            </div>
            <h1 className="font-barlow font-bold text-5xl md:text-7xl mb-4 leading-none uppercase tracking-tight">
              Donde el rugby
              <br />
              <span className="text-[#F5C200]">sigue vivo.</span>
            </h1>
            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
              Equipate bien. Pagá menos. Del vestuario a tu equipo — botines, camisetas y todo lo que necesitás para jugar.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-[#F5C200] text-[#3A3A3A] hover:bg-[#F5C200]/90 font-barlow font-bold uppercase tracking-wide text-base" asChild>
                <Link href="/catalogo">
                  Ver catálogo <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold" asChild>
                <Link href="/catalogo?cat=rugby">Solo rugby</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-8 mt-12 pt-8 border-t border-white/10">
              {[["Rugby", "Especialistas"], ["30 días", "Cambios gratis"], ["MP + Transfer", "Métodos de pago"]].map(([val, label]) => (
                <div key={label}>
                  <p className="font-barlow font-bold text-[#F5C200] text-lg">{val}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#F5C200]" />
      </section>

      {/* Benefits bar */}
      <section className="border-b bg-[#F0F0F0]">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3A3A3A] shrink-0">
                  <Icon className="h-5 w-5 text-[#F5C200]" />
                </div>
                <div>
                  <p className="font-barlow font-bold text-[#3A3A3A] text-sm uppercase tracking-wide">{title}</p>
                  <p className="text-xs text-[#6B6B6B]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-barlow font-semibold text-[#F5C200] uppercase tracking-widest mb-1">Explorá</p>
            <h2 className="font-barlow font-bold text-4xl text-[#3A3A3A] uppercase">Categorías</h2>
          </div>
          <Button variant="outline" className="border-[#3A3A3A] text-[#3A3A3A] hover:bg-[#3A3A3A] hover:text-white font-barlow font-semibold uppercase tracking-wide" asChild>
            <Link href="/catalogo">Ver todo</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/catalogo?cat=${cat.slug}`} className="group">
              <div className="rounded-xl bg-[#3A3A3A] overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 duration-200">
                <div className="aspect-[4/3] flex items-center justify-center text-6xl bg-[#3A3A3A] group-hover:bg-[#F5C200]/10 transition-colors">
                  {cat.emoji}
                </div>
                <div className="p-4 border-t border-white/10">
                  <h3 className="font-barlow font-bold text-white uppercase tracking-wide group-hover:text-[#F5C200] transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{cat.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Values section */}
      <section className="bg-[#F0F0F0] py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-barlow font-semibold text-[#F5C200] uppercase tracking-widest mb-1">Quiénes somos</p>
            <h2 className="font-barlow font-bold text-4xl text-[#3A3A3A] uppercase">Nuestros valores</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {values.map((v) => (
              <div key={v.label} className="rounded-xl bg-white border border-gray-200 p-5">
                <div className="h-1 w-8 bg-[#F5C200] rounded mb-3" />
                <h3 className="font-barlow font-bold text-[#3A3A3A] uppercase tracking-wide mb-1">{v.label}</h3>
                <p className="text-sm text-[#6B6B6B]">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner — Energía (Amarillo TQ fondo) */}
      <section className="bg-[#F5C200] py-16">
        <div className="container mx-auto px-4 text-center">
          <p className="font-barlow font-semibold text-[#3A3A3A]/70 uppercase tracking-widest text-sm mb-2">¿Tenés un club o equipo?</p>
          <h2 className="font-barlow font-bold text-4xl md:text-5xl text-[#3A3A3A] uppercase mb-4">
            Precios especiales
            <br />para pedidos en cantidad
          </h2>
          <p className="text-[#3A3A3A]/70 text-lg mb-8">
            Camisetas con número, equipamiento completo. Consultá sin compromiso.
          </p>
          <Button size="lg" className="bg-[#3A3A3A] text-white hover:bg-black font-barlow font-bold uppercase tracking-wide text-base" asChild>
            <a href="https://wa.me/5491100000000" target="_blank" rel="noopener noreferrer">
              Consultar por WhatsApp
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
