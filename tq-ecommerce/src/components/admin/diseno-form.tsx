"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type HeroConfig = {
  badge: string;
  title: string;
  subtitle: string;
  btn1_text: string;
  btn1_link: string;
  btn1_bg: string;
  btn1_color: string;
  btn2_text: string;
  btn2_link: string;
  btn2_bg: string;
  btn2_color: string;
  image_url: string;
};

export type Banner = {
  id: string;
  isActive: boolean;
  image_url: string;
  video_url: string;
  title: string;
  subtitle: string;
  btn_text: string;
  btn_link: string;
  btn_bg: string;
  btn_color: string;
};

export type CtaConfig = {
  title: string;
  subtitle: string;
  btn_text: string;
  btn_link: string;
  btn_bg: string;
  btn_color: string;
};

const DEFAULT_HERO: HeroConfig = {
  badge: "Nueva colección 2026",
  title: "Donde el rugby sigue vivo.",
  subtitle: "Equipate bien. Pagá menos. Del vestuario a tu equipo — botines, camisetas y todo lo que necesitás para jugar.",
  btn1_text: "Ver catálogo",
  btn1_link: "/catalogo",
  btn1_bg: "#F5C200",
  btn1_color: "#3A3A3A",
  btn2_text: "Solo rugby",
  btn2_link: "/catalogo?cat=rugby",
  btn2_bg: "transparent",
  btn2_color: "#FFFFFF",
  image_url: "",
};

const DEFAULT_CTA: CtaConfig = {
  title: "Precios especiales para pedidos en cantidad",
  subtitle: "Camisetas con número, equipamiento completo. Consultá sin compromiso.",
  btn_text: "Consultar por WhatsApp",
  btn_link: "https://wa.me/5493794339447",
  btn_bg: "#3A3A3A",
  btn_color: "#FFFFFF",
};

function youtubeEmbed(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const isTransparent = value === "transparent" || value === "";
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isTransparent ? "#ffffff" : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border cursor-pointer p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#F5C200 o transparent"
          className="h-8 text-sm font-mono"
        />
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          {icon} {title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2 border-t space-y-4">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

function ImagePreview({ url }: { url: string }) {
  if (!url) return null;
  return (
    <div className="mt-2 rounded-lg overflow-hidden border aspect-video max-w-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
    </div>
  );
}

function VideoPreview({ url }: { url: string }) {
  const embed = youtubeEmbed(url);
  if (!embed) return null;
  return (
    <div className="mt-2 rounded-lg overflow-hidden border aspect-video max-w-sm">
      <iframe src={embed} className="w-full h-full" allow="accelerometer; autoplay; encrypted-media" allowFullScreen />
    </div>
  );
}

export function DisenoForm({ initial }: {
  initial: { homepage_hero?: HeroConfig; homepage_banners?: Banner[]; homepage_cta?: CtaConfig };
}) {
  const [hero, setHero] = useState<HeroConfig>(initial.homepage_hero ?? DEFAULT_HERO);
  const [banners, setBanners] = useState<Banner[]>(initial.homepage_banners ?? []);
  const [cta, setCta] = useState<CtaConfig>(initial.homepage_cta ?? DEFAULT_CTA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const res = await fetch("/api/admin/diseno", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homepage_hero: hero, homepage_banners: banners, homepage_cta: cta }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError("Error al guardar");
  }

  function addBanner() {
    setBanners((prev) => [...prev, {
      id: crypto.randomUUID(), isActive: true,
      image_url: "", video_url: "", title: "", subtitle: "", btn_text: "", btn_link: "",
      btn_bg: "#F5C200", btn_color: "#3A3A3A",
    }]);
  }

  function updateBanner(id: string, patch: Partial<Banner>) {
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b));
  }

  function removeBanner(id: string) {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Save feedback */}
      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Cambios guardados. Se verán reflejados en la tienda.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Hero */}
      <Section title="Hero principal" icon={<ImageIcon className="h-4 w-4 text-blue-600" />}>
        <Field label="Badge (texto pequeño arriba)" hint='Ej: "Nueva colección 2026"'>
          <Input value={hero.badge} onChange={(e) => setHero({ ...hero, badge: e.target.value })} placeholder="Nueva colección 2026" />
        </Field>
        <Field label="Título principal">
          <Input value={hero.title} onChange={(e) => setHero({ ...hero, title: e.target.value })} placeholder="Donde el rugby sigue vivo." />
        </Field>
        <Field label="Subtítulo">
          <textarea
            value={hero.subtitle}
            onChange={(e) => setHero({ ...hero, subtitle: e.target.value })}
            rows={2}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Field>
        <div className="rounded-lg border p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Botón principal</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Texto">
              <Input value={hero.btn1_text} onChange={(e) => setHero({ ...hero, btn1_text: e.target.value })} placeholder="Ver catálogo" />
            </Field>
            <Field label="Link">
              <Input value={hero.btn1_link} onChange={(e) => setHero({ ...hero, btn1_link: e.target.value })} placeholder="/catalogo" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorPicker label="Color de fondo" value={hero.btn1_bg ?? "#F5C200"} onChange={(v) => setHero({ ...hero, btn1_bg: v })} />
            <ColorPicker label="Color de texto" value={hero.btn1_color ?? "#3A3A3A"} onChange={(v) => setHero({ ...hero, btn1_color: v })} />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-gray-500">Vista previa:</span>
            <span className="px-4 py-1.5 rounded-lg text-sm font-bold" style={{ background: hero.btn1_bg || "#F5C200", color: hero.btn1_color || "#3A3A3A" }}>
              {hero.btn1_text || "Botón"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Botón secundario</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Texto">
              <Input value={hero.btn2_text} onChange={(e) => setHero({ ...hero, btn2_text: e.target.value })} placeholder="Solo rugby" />
            </Field>
            <Field label="Link">
              <Input value={hero.btn2_link} onChange={(e) => setHero({ ...hero, btn2_link: e.target.value })} placeholder="/catalogo?cat=rugby" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorPicker label="Color de fondo" value={hero.btn2_bg ?? "transparent"} onChange={(v) => setHero({ ...hero, btn2_bg: v })} />
            <ColorPicker label="Color de texto" value={hero.btn2_color ?? "#FFFFFF"} onChange={(v) => setHero({ ...hero, btn2_color: v })} />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-gray-500">Vista previa:</span>
            <span className="px-4 py-1.5 rounded-lg text-sm font-bold border border-current" style={{ background: hero.btn2_bg || "transparent", color: hero.btn2_color || "#FFFFFF" }}>
              {hero.btn2_text || "Botón"}
            </span>
          </div>
        </div>
        <Field label="Imagen de fondo" hint="Pegá la URL de una imagen (JPG, PNG, WebP). Dejá vacío para usar el fondo con patrón.">
          <Input value={hero.image_url} onChange={(e) => setHero({ ...hero, image_url: e.target.value })} placeholder="https://..." />
          <ImagePreview url={hero.image_url} />
        </Field>
      </Section>

      {/* Banners */}
      <Section title="Banners / Contenido destacado" icon={<ImageIcon className="h-4 w-4 text-purple-600" />} defaultOpen={false}>
        <p className="text-xs text-gray-500">Estos banners aparecen debajo de las categorías. Podés agregar imágenes o videos de YouTube.</p>
        {banners.map((banner, i) => (
          <div key={banner.id} className="rounded-lg border p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Banner {i + 1}</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={banner.isActive} onChange={(e) => updateBanner(banner.id, { isActive: e.target.checked })} className="rounded" />
                  Activo
                </label>
                <button type="button" onClick={() => removeBanner(banner.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Field label="Imagen URL" hint="URL directa a imagen (JPG, PNG, WebP)">
              <Input value={banner.image_url} onChange={(e) => updateBanner(banner.id, { image_url: e.target.value, video_url: "" })} placeholder="https://..." />
              <ImagePreview url={banner.image_url} />
            </Field>
            <Field label="O Video YouTube URL" hint="URL de YouTube (ej: https://youtu.be/xxxxx). Si hay imagen y video, se muestra el video.">
              <Input value={banner.video_url} onChange={(e) => updateBanner(banner.id, { video_url: e.target.value, image_url: "" })} placeholder="https://youtu.be/..." />
              <VideoPreview url={banner.video_url} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título">
                <Input value={banner.title} onChange={(e) => updateBanner(banner.id, { title: e.target.value })} placeholder="Título del banner" />
              </Field>
              <Field label="Subtítulo">
                <Input value={banner.subtitle} onChange={(e) => updateBanner(banner.id, { subtitle: e.target.value })} placeholder="Texto secundario" />
              </Field>
              <Field label="Botón — Texto">
                <Input value={banner.btn_text} onChange={(e) => updateBanner(banner.id, { btn_text: e.target.value })} placeholder="Ver más" />
              </Field>
              <Field label="Botón — Link">
                <Input value={banner.btn_link} onChange={(e) => updateBanner(banner.id, { btn_link: e.target.value })} placeholder="/catalogo" />
              </Field>
              <ColorPicker label="Botón — Fondo" value={banner.btn_bg ?? "#F5C200"} onChange={(v) => updateBanner(banner.id, { btn_bg: v })} />
              <ColorPicker label="Botón — Texto" value={banner.btn_color ?? "#3A3A3A"} onChange={(v) => updateBanner(banner.id, { btn_color: v })} />
            </div>
            {banner.btn_text && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-500">Vista previa:</span>
                <span className="px-3 py-1 rounded-lg text-sm font-bold" style={{ background: banner.btn_bg || "#F5C200", color: banner.btn_color || "#3A3A3A" }}>
                  {banner.btn_text}
                </span>
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addBanner} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> Agregar banner
        </Button>
      </Section>

      {/* CTA */}
      <Section title="Sección de contacto / CTA" icon={<Video className="h-4 w-4 text-green-600" />} defaultOpen={false}>
        <Field label="Título">
          <textarea
            value={cta.title}
            onChange={(e) => setCta({ ...cta, title: e.target.value })}
            rows={2}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Field>
        <Field label="Subtítulo">
          <textarea
            value={cta.subtitle}
            onChange={(e) => setCta({ ...cta, subtitle: e.target.value })}
            rows={2}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Botón — Texto">
            <Input value={cta.btn_text} onChange={(e) => setCta({ ...cta, btn_text: e.target.value })} placeholder="Consultar por WhatsApp" />
          </Field>
          <Field label="Botón — Link">
            <Input value={cta.btn_link} onChange={(e) => setCta({ ...cta, btn_link: e.target.value })} placeholder="https://wa.me/..." />
          </Field>
          <ColorPicker label="Botón — Fondo" value={cta.btn_bg ?? "#3A3A3A"} onChange={(v) => setCta({ ...cta, btn_bg: v })} />
          <ColorPicker label="Botón — Texto" value={cta.btn_color ?? "#FFFFFF"} onChange={(v) => setCta({ ...cta, btn_color: v })} />
        </div>
        {cta.btn_text && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500">Vista previa:</span>
            <span className="px-4 py-1.5 rounded-lg text-sm font-bold" style={{ background: cta.btn_bg || "#3A3A3A", color: cta.btn_color || "#FFFFFF" }}>
              {cta.btn_text}
            </span>
          </div>
        )}
      </Section>

      <Button onClick={save} disabled={saving} size="lg" className="w-full">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando...</> : "Guardar cambios"}
      </Button>
    </div>
  );
}
