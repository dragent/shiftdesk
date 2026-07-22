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
      <header className="cf-header-gradient sticky top-0 z-10 shadow-lg shadow-blue-950/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-bold text-[var(--cf-blue)] shadow-md">
              C
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-white">Carrefour Accueil</span>
              <span className="text-[11px] font-semibold tracking-wide text-red-300">
                GESTION DE L&apos;ACCUEIL
              </span>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span className="hidden text-blue-100 sm:inline">
                {user.firstName} {user.lastName}
                {user.site ? ` · ${user.site.name}` : ""}
              </span>
              <button
                onClick={logout}
                className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-white transition hover:border-[var(--cf-red)] hover:bg-[var(--cf-red)]"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-0">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "text-white"
                    : "text-blue-100 hover:text-white"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-sm bg-[var(--cf-red)]" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="cf-brand-stripe h-1 w-full" />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-slate-200/70 bg-white/60 px-4 py-3 text-center text-xs text-slate-400 backdrop-blur">
        Carrefour Accueil — Gestion de l&apos;accueil, des pauses, des plannings et supervision IA.
      </footer>
    </div>
  );
}
