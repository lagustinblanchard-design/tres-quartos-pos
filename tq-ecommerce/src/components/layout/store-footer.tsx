import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";

export function StoreFooter() {
  return (
    <footer className="bg-[#3A3A3A] text-gray-300 mt-16">
      {/* Top accent line */}
      <div className="h-1 bg-[#F5C200]" />

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-10 w-10 rounded-full bg-[#3A3A3A] border-2 border-[#F5C200] flex items-center justify-center shrink-0">
                <span className="font-barlow font-bold text-[#F5C200] text-sm">TQ</span>
              </div>
              <div>
                <p className="font-barlow font-bold text-white text-lg leading-none uppercase">Tres Quartos</p>
                <p className="text-[10px] text-[#F5C200] font-light leading-none mt-0.5">Donde el rugby sigue vivo.</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Del vestuario a tu equipo. Equipamiento deportivo con alma de rugby, abierto a todos los deportes.
            </p>
            <div className="flex gap-4">
              <a href="#" aria-label="Instagram" className="text-sm font-barlow font-semibold text-[#F5C200] hover:text-white transition-colors uppercase tracking-wide">
                Instagram
              </a>
              <a href="#" aria-label="WhatsApp" className="text-sm font-barlow font-semibold text-[#F5C200] hover:text-white transition-colors uppercase tracking-wide">
                WhatsApp
              </a>
            </div>
          </div>

          {/* Catálogo */}
          <div>
            <h4 className="font-barlow font-bold text-white uppercase tracking-wide mb-4">Catálogo</h4>
            <ul className="space-y-2 text-sm">
              {[
                { name: "Rugby", href: "/catalogo?cat=rugby" },
                { name: "Camisetas", href: "/catalogo?cat=camisetas" },
                { name: "Botines", href: "/catalogo?cat=botines" },
                { name: "Fútbol", href: "/catalogo?cat=futbol" },
                { name: "Running", href: "/catalogo?cat=running" },
                { name: "Novedades", href: "/catalogo?sort=newest" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-[#F5C200] transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ayuda */}
          <div>
            <h4 className="font-barlow font-bold text-white uppercase tracking-wide mb-4">Ayuda</h4>
            <ul className="space-y-2 text-sm">
              {[
                { name: "Seguir pedido", href: "/seguimiento" },
                { name: "Guía de talles", href: "/guia-talles" },
                { name: "Devoluciones", href: "/devoluciones" },
                { name: "Preguntas frecuentes", href: "/faq" },
                { name: "Contacto", href: "/contacto" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-[#F5C200] transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="font-barlow font-bold text-white uppercase tracking-wide mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#F5C200] shrink-0" />
                <span>Buenos Aires, Argentina</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#F5C200] shrink-0" />
                <a href="tel:+5491100000000" className="hover:text-[#F5C200] transition-colors">+54 9 11 0000-0000</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#F5C200] shrink-0" />
                <a href="mailto:info@tresquartos.com.ar" className="hover:text-[#F5C200] transition-colors">info@tresquartos.com.ar</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© 2026 Tres Quartos. Todos los derechos reservados.</p>
          <p className="text-[#F5C200] font-barlow font-semibold italic text-xs">
            &ldquo;Jugado. Vendido. Vuelto a jugar.&rdquo;
          </p>
          <div className="flex gap-4">
            <Link href="/privacidad" className="hover:text-gray-300">Privacidad</Link>
            <Link href="/terminos" className="hover:text-gray-300">Términos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
