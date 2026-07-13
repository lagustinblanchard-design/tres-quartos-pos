"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart2,
  FileText,
  Monitor,
  Boxes,
  Truck,
  Settings,
  ChevronRight,
  UserCog,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/stock", label: "Stock", icon: Boxes },
  { href: "/admin/compras", label: "Compras", icon: Truck },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/pos", label: "Punto de Venta", icon: Monitor },
  { href: "/admin/facturacion", label: "Facturación", icon: FileText },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart2 },
  { href: "/admin/diseno", label: "Diseño", icon: Palette },
  { href: "/admin/equipo", label: "Equipo", icon: UserCog },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-700">
        <Link href="/admin" className="font-bold text-xl text-blue-400">
          TQ Admin
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-4 w-4" />}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-gray-700 p-4">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
          ← Ver tienda
        </Link>
      </div>
    </aside>
  );
}
