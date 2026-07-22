"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

interface NavItem {
  href: string;
  label: string;
  roles?: Array<"ROLE_ADMIN" | "ROLE_DIRECTION" | "ROLE_HOTE">;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/accueil/pauses", label: "Mes pauses", roles: ["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/accueil/demandes", label: "Demandes accueil", roles: ["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/direction/planning", label: "Planning", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/direction/supervision-ia", label: "Supervision IA", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/admin/utilisateurs", label: "Utilisateurs", roles: ["ROLE_ADMIN"] },
  { href: "/admin/categories", label: "Catégories", roles: ["ROLE_ADMIN"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
              C
            </span>
            <span className="text-lg font-semibold">Carrefour Accueil</span>
          </div>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-600">
                {user.firstName} {user.lastName}
                {user.site ? ` · ${user.site.name}` : ""}
              </span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-2">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
