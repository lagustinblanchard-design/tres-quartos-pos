import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, Shield, RotateCcw, MessageCircle } from "lucide-react";
import { StoreHeader } from "@/components/layout/store-header";
import { StoreFooter } from "@/components/layout/store-footer";
import { CartProvider } from "@/lib/cart-context";
import { CartDrawer } from "@/components/store/cart-drawer";
import { prisma } from "@/lib/prisma";
import { HeroReveal, FadeUp, StaggerList, StaggerItem } from "@/components/store/animations";

export const dynamic = "force-dynamic";

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

function youtubeEmbed(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

export default async function HomePage() {
  const configs = await prisma.businessConfig.findMany({
    where: { key: { in: ["homepage_hero", "homepage_banners", "homepage_cta"] } },
  });
  const cfg = Object.fromEntries(configs.map((c) => [c.key, JSON.parse(c.value)]));

  const hero = cfg.homepage_hero ?? {};
  const banners: Array<{
    id: string; isActive: boolean; image_url: string; video_url: string;
    title: string; subtitle: string; btn_text: string; btn_link: string;
    btn_bg: string; btn_color: string;
  }> = (cfg.homepage_banners ?? []).filter((b: { isActive: boolean }) => b.isActive);
  const cta = cfg.homepage_cta ?? {};

  const heroTitle = hero.title ?? "Donde el rugby sigue vivo.";
  const heroSubtitle = hero.subtitle ?? "Equipate bien. Pagá menos. Del vestuario a tu equipo — botines, camisetas y todo lo que necesitás para jugar.";
  const heroBadge = hero.badge ?? "Nueva colección 2026";
  const heroBtn1Text = hero.btn1_text ?? "Ver catálogo";
  const heroBtn1Link = hero.btn1_link ?? "/catalogo";
  const heroBtn2Text = hero.btn2_text ?? "Solo rugby";
  const heroBtn2Link = hero.btn2_link ?? "/catalogo?cat=rugby";
  const heroBtn1Bg = hero.btn1_bg ?? "#F5C200";
  const heroBtn1Color = hero.btn1_color ?? "#3A3A3A";
  const heroBtn2Bg = hero.btn2_bg ?? "transparent";
  const heroBtn2Color = hero.btn2_color ?? "#FFFFFF";
  const heroImageUrl = hero.image_url ?? "";

  const ctaTitle = cta.title ?? "Precios especiales para pedidos en cantidad";
  const ctaSubtitle = cta.subtitle ?? "Camisetas con número, equipamiento completo. Consultá sin compromiso.";
  const ctaBtnText = cta.btn_text ?? "Consultar por WhatsApp";
  const ctaBtnLink = cta.btn_link ?? "https://wa.me/5493794339447";
  const ctaBtnBg = cta.btn_bg ?? "#3A3A3A";
  const ctaBtnColor = cta.btn_color ?? "#FFFFFF";

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <StoreHeader />
        <main className="flex-1">
          <div>
            {/* ── Hero ── */}
            <section
              className="relative bg-[#3A3A3A] text-white overflow-hidden"
              style={heroImageUrl ? { backgroundImage: `url(${heroImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
            >
              {heroImageUrl && <div className="absolute inset-0 bg-[#3A3A3A]/70" />}
              {!heroImageUrl && (
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: "repeating-linear-gradient(45deg, #F5C200 0px, #F5C200 1px, transparent 0px, transparent 50%)",
                    backgroundSize: "20px 20px",
                  }} />
                </div>
              )}

              <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
                <div className="max-w-2xl">
                  {/* Badge */}
                  <HeroReveal delay={0}>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#F5C200]/20 border border-[#F5C200]/40 px-4 py-1.5 mb-6">
                      <span className="text-[#F5C200] text-xs font-barlow font-semibold uppercase tracking-widest">
                        {heroBadge}
                      </span>
                    </div>
                  </HeroReveal>

                  {/* Title */}
                  <HeroReveal delay={0.12}>
                    <h1 className="font-barlow font-bold text-5xl md:text-7xl mb-4 leading-none uppercase tracking-tight">
                      {heroTitle.includes("sigue vivo") ? (
                        <>
                          Donde el rugby
                          <br />
                          <span className="text-[#F5C200]">sigue vivo.</span>
                        </>
                      ) : (
                        heroTitle
                      )}
                    </h1>
                  </HeroReveal>

                  {/* Subtitle */}
                  <HeroReveal delay={0.24}>
                    <p className="text-gray-300 text-lg mb-8 leading-relaxed">{heroSubtitle}</p>
                  </HeroReveal>

                  {/* Buttons */}
                  <HeroReveal delay={0.36}>
                    <div className="flex flex-wrap gap-4">
                      <Button
                        size="lg"
                        className="font-barlow font-bold uppercase tracking-wide text-base"
                        style={{ background: heroBtn1Bg, color: heroBtn1Color }}
                        asChild
                      >
                        <Link href={heroBtn1Link}>
                          {heroBtn1Text} <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                      </Button>
                      {heroBtn2Text && (
                        <Button
                          size="lg"
                          variant="outline"
                          className="font-semibold"
                          style={{ background: heroBtn2Bg, color: heroBtn2Color, borderColor: heroBtn2Color }}
                          asChild
                        >
                          <Link href={heroBtn2Link}>{heroBtn2Text}</Link>
                        </Button>
                      )}
                    </div>
                  </HeroReveal>

                  {/* Stats */}
                  <HeroReveal delay={0.5}>
                    <div className="flex gap-8 mt-12 pt-8 border-t border-white/10">
                      {[["Rugby", "Especialistas"], ["30 días", "Cambios gratis"], ["MP + Transfer", "Métodos de pago"]].map(([val, label]) => (
                        <div key={label}>
                          <p className="font-barlow font-bold text-[#F5C200] text-lg">{val}</p>
                          <p className="text-xs text-gray-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </HeroReveal>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#F5C200]" />
            </section>

            {/* ── Benefits ── */}
            <section className="border-b bg-[#F0F0F0]">
              <div className="container mx-auto px-4 py-6">
                <StaggerList className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {benefits.map(({ icon: Icon, title, desc }) => (
                    <StaggerItem key={title}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3A3A3A] shrink-0">
                          <Icon className="h-5 w-5 text-[#F5C200]" />
                        </div>
                        <div>
                          <p className="font-barlow font-bold text-[#3A3A3A] text-sm uppercase tracking-wide">{title}</p>
                          <p className="text-xs text-[#6B6B6B]">{desc}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </div>
            </section>

            {/* ── Categories ── */}
            <section className="container mx-auto px-4 py-16">
              <FadeUp className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs font-barlow font-semibold text-[#F5C200] uppercase tracking-widest mb-1">Explorá</p>
                  <h2 className="font-barlow font-bold text-4xl text-[#3A3A3A] uppercase">Categorías</h2>
                </div>
                <Button variant="outline" className="border-[#3A3A3A] text-[#3A3A3A] hover:bg-[#3A3A3A] hover:text-white font-barlow font-semibold uppercase tracking-wide" asChild>
                  <Link href="/catalogo">Ver todo</Link>
                </Button>
              </FadeUp>

              <StaggerList className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map((cat) => (
                  <StaggerItem key={cat.slug}>
                    <Link href={`/catalogo?cat=${cat.slug}`} className="group block">
                      <div className="rounded-xl bg-[#3A3A3A] overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                        <div className="aspect-[4/3] flex items-center justify-center text-6xl bg-[#3A3A3A] group-hover:bg-[#F5C200]/10 transition-colors duration-300">
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
                  </StaggerItem>
                ))}
              </StaggerList>
            </section>

            {/* ── Dynamic banners ── */}
            {banners.length > 0 && (
              <section className="container mx-auto px-4 pb-16">
                <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {banners.map((banner) => (
                    <StaggerItem key={banner.id}>
                      <div className="rounded-xl overflow-hidden border shadow-sm bg-[#3A3A3A] text-white hover:shadow-lg transition-shadow duration-300">
                        {banner.video_url ? (
                          <div className="aspect-video">
                            <iframe
                              src={youtubeEmbed(banner.video_url)}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; encrypted-media"
                              allowFullScreen
                            />
                          </div>
                        ) : banner.image_url ? (
                          <div className="aspect-video overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                          </div>
                        ) : null}
                        {(banner.title || banner.btn_text) && (
                          <div className="p-5">
                            {banner.title && <h3 className="font-barlow font-bold text-lg uppercase">{banner.title}</h3>}
                            {banner.subtitle && <p className="text-sm text-gray-300 mt-1">{banner.subtitle}</p>}
                            {banner.btn_text && banner.btn_link && (
                              <Link
                                href={banner.btn_link}
                                className="inline-block mt-3 font-bold text-sm px-4 py-2 rounded-lg transition-colors"
                                style={{ background: banner.btn_bg || "#F5C200", color: banner.btn_color || "#3A3A3A" }}
                              >
                                {banner.btn_text}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </section>
            )}

            {/* ── Values ── */}
            <section className="bg-[#F0F0F0] py-16">
              <div className="container mx-auto px-4">
                <FadeUp className="text-center mb-10">
                  <p className="text-xs font-barlow font-semibold text-[#F5C200] uppercase tracking-widest mb-1">Quiénes somos</p>
                  <h2 className="font-barlow font-bold text-4xl text-[#3A3A3A] uppercase">Nuestros valores</h2>
                </FadeUp>
                <StaggerList className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {values.map((v) => (
                    <StaggerItem key={v.label}>
                      <div className="rounded-xl bg-white border border-gray-200 p-5 hover:shadow-md transition-shadow duration-300">
                        <div className="h-1 w-8 bg-[#F5C200] rounded mb-3" />
                        <h3 className="font-barlow font-bold text-[#3A3A3A] uppercase tracking-wide mb-1">{v.label}</h3>
                        <p className="text-sm text-[#6B6B6B]">{v.desc}</p>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </div>
            </section>

            {/* ── CTA ── */}
            <section className="bg-[#F5C200] py-16">
              <FadeUp className="container mx-auto px-4 text-center">
                <p className="font-barlow font-semibold text-[#3A3A3A]/70 uppercase tracking-widest text-sm mb-2">¿Tenés un club o equipo?</p>
                <h2 className="font-barlow font-bold text-4xl md:text-5xl text-[#3A3A3A] uppercase mb-4 whitespace-pre-line">
                  {ctaTitle}
                </h2>
                <p className="text-[#3A3A3A]/70 text-lg mb-8">{ctaSubtitle}</p>
                <Button
                  size="lg"
                  className="font-barlow font-bold uppercase tracking-wide text-base"
                  style={{ background: ctaBtnBg, color: ctaBtnColor }}
                  asChild
                >
                  <a href={ctaBtnLink} target="_blank" rel="noopener noreferrer">
                    {ctaBtnText}
                  </a>
                </Button>
              </FadeUp>
            </section>
          </div>
        </main>
        <StoreFooter />
        <CartDrawer />

        <a
          href={ctaBtnLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg hover:bg-green-600 transition-colors"
          aria-label="WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      </div>
    </CartProvider>
  );
}
