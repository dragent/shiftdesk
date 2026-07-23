"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import type { UserRole } from "@/lib/types";

interface NavLink {
  href: string;
  label: string;
  roles?: UserRole[];
}

interface NavDropdown {
  label: string;
  roles?: UserRole[];
  items: NavLink[];
}

type NavEntry = NavLink | NavDropdown;

function isDropdown(entry: NavEntry): entry is NavDropdown {
  return "items" in entry;
}

const NAV_ITEMS: NavEntry[] = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/accueil/pauses", label: "Pauses caissiers", roles: ["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/accueil/caissiers", label: "Caissiers", roles: ["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/accueil/demandes", label: "Demandes accueil", roles: ["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"] },
  {
    label: "Planning",
    roles: ["ROLE_HOTE", "ROLE_CAISSIER", "ROLE_RAYON", "ROLE_SECURITE", "ROLE_DIRECTION", "ROLE_ADMIN"],
    items: [
      { href: "/direction/planning", label: "Planning", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
      { href: "/accueil/planning", label: "Planning", roles: ["ROLE_HOTE", "ROLE_CAISSIER", "ROLE_RAYON", "ROLE_SECURITE"] },
      { href: "/accueil/plan-de-caisse", label: "Plan de caisse", roles: ["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"] },
    ],
  },
  { href: "/direction/supervision-ia", label: "Supervision IA", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/admin/utilisateurs", label: "Utilisateurs", roles: ["ROLE_ADMIN"] },
  { href: "/admin/categories", label: "Catégories", roles: ["ROLE_ADMIN"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Referme le menu mobile à chaque changement de page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function visibleLinks(items: NavLink[]): NavLink[] {
    return items.filter((item) => !item.roles || hasRole(...item.roles));
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles))
    .map((item) => (isDropdown(item) ? { ...item, items: visibleLinks(item.items) } : item))
    .filter((item) => !isDropdown(item) || item.items.length > 0);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="cf-header-gradient sticky top-0 z-10 shadow-lg shadow-blue-950/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-md">
              <Image
                src="/carrefour-logo.png"
                alt="Carrefour"
                width={32}
                height={32}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-white">Carrefour Accueil</span>
              <span className="hidden text-[11px] font-semibold tracking-wide text-red-300 sm:inline">
                GESTION DE L&apos;ACCUEIL
              </span>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2 text-sm sm:gap-4">
              <span className="hidden text-blue-100 md:inline">
                {user.firstName} {user.lastName}
                {user.site ? ` · ${user.site.name}` : ""}
              </span>
              <button
                onClick={logout}
                className="hidden rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-white transition hover:border-[var(--cf-red)] hover:bg-[var(--cf-red)] sm:inline-block"
              >
                Se déconnecter
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                aria-expanded={menuOpen}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/30 bg-white/10 text-white transition hover:border-[var(--cf-red)] hover:bg-[var(--cf-red)] md:hidden"
              >
                {menuOpen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
        <nav className="mx-auto hidden max-w-6xl flex-wrap gap-1 px-4 pb-0 md:flex">
          {visibleItems.map((item) =>
            isDropdown(item) ? (
              <NavDropdownMenu
                key={item.label}
                label={item.label}
                items={item.items}
                active={item.items.some((sub) => pathname === sub.href)}
              />
            ) : (
              <NavLinkItem key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
            ),
          )}
        </nav>
        {menuOpen && (
          <nav className="mx-auto flex max-w-6xl flex-col gap-0.5 border-t border-white/10 px-4 py-2 md:hidden">
            {user && (
              <span className="px-3 py-1.5 text-xs text-blue-100">
                {user.firstName} {user.lastName}
                {user.site ? ` · ${user.site.name}` : ""}
              </span>
            )}
            {visibleItems.map((item) =>
              isDropdown(item) ? (
                <div key={item.label} className="flex flex-col">
                  <span className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-200">
                    {item.label}
                  </span>
                  {item.items.map((sub) => (
                    <MobileNavLink key={sub.href} href={sub.href} label={sub.label} active={pathname === sub.href} />
                  ))}
                </div>
              ) : (
                <MobileNavLink key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
              ),
            )}
            <button
              onClick={logout}
              className="mt-1 rounded-md border border-white/30 bg-white/10 px-3 py-2 text-left text-sm text-white transition hover:border-[var(--cf-red)] hover:bg-[var(--cf-red)]"
            >
              Se déconnecter
            </button>
          </nav>
        )}
        <div className="cf-brand-stripe h-1 w-full" />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </main>
      <footer className="border-t border-slate-200/70 bg-white/60 px-4 py-3 text-center text-xs text-slate-400 backdrop-blur">
        Carrefour Accueil — Gestion de l&apos;accueil, des pauses, des plannings et supervision IA.
      </footer>
    </div>
  );
}

function MobileNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function NavLinkItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-2.5 text-sm font-medium transition ${
        active ? "text-white" : "text-blue-100 hover:text-white"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-sm bg-[var(--cf-red)]" />}
    </Link>
  );
}

function NavDropdownMenu({ label, items, active }: { label: string; items: NavLink[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition ${
          active ? "text-white" : "text-blue-100 hover:text-white"
        }`}
      >
        {label}
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        {active && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-sm bg-[var(--cf-red)]" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
