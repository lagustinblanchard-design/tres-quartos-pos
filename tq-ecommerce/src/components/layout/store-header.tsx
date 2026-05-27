"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Heart, User, Search, Menu, X, LogOut, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import { useSession, signOut } from "next-auth/react";

const categories = [
  { name: "Rugby", href: "/catalogo?cat=rugby" },
  { name: "Camisetas", href: "/catalogo?cat=camisetas" },
  { name: "Botines", href: "/catalogo?cat=botines" },
  { name: "Fútbol", href: "/catalogo?cat=futbol" },
  { name: "Running", href: "/catalogo?cat=running" },
  { name: "Novedades", href: "/catalogo?sort=newest" },
];

export function StoreHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { totalItems, openCart } = useCart();
  const { data: session } = useSession();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white shadow-sm">
      {/* Announcement bar */}
      <div className="bg-[#3A3A3A] text-[#F5C200] text-center text-xs py-1.5 font-medium tracking-wide">
        Envío gratis en compras mayores a $50.000 · <span className="text-white">Donde el rugby sigue vivo.</span>
      </div>

      <div className="container mx-auto px-4">
        {/* Top bar */}
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image src="/logo.png" alt="Tres Quartos" width={36} height={36} className="rounded-full shrink-0" />
            <div className="hidden sm:block">
              <p className="font-barlow font-bold text-[#3A3A3A] text-lg leading-none uppercase tracking-wide">
                Tres Quartos
              </p>
              <p className="text-[10px] text-[#6B6B6B] leading-none font-light">Donde el rugby sigue vivo</p>
            </div>
          </Link>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-[#F5C200] focus-within:ring-1 focus-within:ring-[#F5C200] transition-all">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="search"
              placeholder="Buscar botines, camisetas, accesorios..."
              className="flex-1 bg-transparent text-sm outline-none text-[#3A3A3A] placeholder:text-gray-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="text-[#3A3A3A] hover:text-[#F5C200] hover:bg-[#F5C200]/10">
              <Link href="/cuenta/favoritos" aria-label="Favoritos">
                <Heart className="h-5 w-5" />
              </Link>
            </Button>

            {/* User menu */}
            {session ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-[#F5C200]/10 transition-colors"
                  aria-label="Mi cuenta"
                >
                  <div className="h-7 w-7 rounded-full bg-[#3A3A3A] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#F5C200]">
                      {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden lg:block max-w-[100px] truncate text-[#3A3A3A]">
                    {session.user.name?.split(" ")[0]}
                  </span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-50 py-1">
                    <div className="px-3 py-2 border-b">
                      <p className="text-xs font-semibold text-[#3A3A3A] truncate">{session.user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{session.user.email}</p>
                    </div>
                    <Link
                      href="/cuenta"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[#3A3A3A] hover:bg-gray-50"
                    >
                      <User className="h-4 w-4" /> Mi cuenta
                    </Link>
                    <Link
                      href="/cuenta/pedidos"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[#3A3A3A] hover:bg-gray-50"
                    >
                      <Package className="h-4 w-4" /> Mis pedidos
                    </Link>
                    <div className="border-t mt-1 pt-1">
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" /> Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button variant="ghost" size="sm" asChild className="text-[#3A3A3A] hover:text-[#F5C200] hover:bg-[#F5C200]/10">
                <Link href="/login" className="flex items-center gap-1.5">
                  <User className="h-5 w-5" />
                  <span className="hidden lg:block">Ingresar</span>
                </Link>
              </Button>
            )}

            {/* Cart */}
            <button
              onClick={openCart}
              aria-label={`Carrito (${totalItems} productos)`}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-[#3A3A3A] hover:text-[#F5C200] hover:bg-[#F5C200]/10 transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F5C200] text-[10px] font-bold text-[#3A3A3A] leading-none">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-[#3A3A3A]"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menú"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Desktop navigation */}
        <nav className="hidden md:flex h-10 items-center gap-6 text-sm font-semibold border-t border-gray-100">
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="text-[#6B6B6B] hover:text-[#F5C200] transition-colors uppercase tracking-wide text-xs font-barlow"
            >
              {cat.name}
            </Link>
          ))}
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden py-4 flex flex-col gap-3 border-t border-gray-100">
            <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 focus-within:border-[#F5C200]">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="search"
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            {categories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="text-[#3A3A3A] hover:text-[#F5C200] py-1 font-barlow font-semibold uppercase tracking-wide text-sm transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
