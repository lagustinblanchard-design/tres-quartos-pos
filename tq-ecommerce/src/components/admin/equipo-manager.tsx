"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, Loader2 } from "lucide-react";

type TeamUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

export function EquipoManager({
  admins,
  currentUserId,
}: {
  admins: TeamUser[];
  currentUserId: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState<TeamUser | null | "not_found">(null);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  const buscar = async () => {
    if (!email.trim()) return;
    setSearching(true);
    setSearch(null);
    const res = await fetch(`/api/admin/equipo/buscar?email=${encodeURIComponent(email.trim())}`);
    if (res.ok) {
      setSearch(await res.json());
    } else {
      setSearch("not_found");
    }
    setSearching(false);
  };

  const cambiarRol = async (userId: string, role: "ADMIN" | "CLIENTE") => {
    setLoading(userId);
    const res = await fetch("/api/admin/equipo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) {
      setSearch(null);
      setEmail("");
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error al cambiar rol");
    }
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Agregar admin */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Dar acceso de administrador</h2>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Email del usuario..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={buscar}
            disabled={searching || !email.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </button>
        </div>

        {search === "not_found" && (
          <p className="mt-3 text-sm text-red-500">No se encontró ningún usuario con ese email. El usuario debe registrarse primero en la tienda.</p>
        )}

        {search && search !== "not_found" && (
          <div className="mt-3 flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <div>
              <p className="font-medium text-sm">{search.name ?? "Sin nombre"}</p>
              <p className="text-xs text-gray-500">{search.email}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${search.role === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                {search.role === "ADMIN" ? "Admin" : "Cliente"}
              </span>
            </div>
            {search.role !== "ADMIN" ? (
              <button
                onClick={() => cambiarRol(search.id, "ADMIN")}
                disabled={loading === search.id}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {loading === search.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Dar admin
              </button>
            ) : (
              <p className="text-sm text-blue-600 font-medium">Ya es admin</p>
            )}
          </div>
        )}
      </div>

      {/* Lista de admins */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Equipo actual</h2>
          <p className="text-xs text-gray-400 mt-0.5">{admins.length} {admins.length === 1 ? "administrador" : "administradores"}</p>
        </div>
        <div className="divide-y">
          {admins.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-6 py-4">
              <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                {(u.name ?? u.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{u.name ?? "Sin nombre"}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              {u.id !== currentUserId && (
                <button
                  onClick={() => cambiarRol(u.id, "CLIENTE")}
                  disabled={loading === u.id}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                  Quitar admin
                </button>
              )}
              {u.id === currentUserId && (
                <span className="text-xs text-gray-400">Vos</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
