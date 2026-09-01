"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { userInitials } from "@/lib/employees";
import { useUnreadNotes } from "@/lib/UnreadNotesContext";
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
  { href: "/direction/employes", label: "Employés", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
  {
    label: "Planning",
    roles: ["ROLE_HOTE", "ROLE_CAISSIER", "ROLE_LAD", "ROLE_RAYON", "ROLE_SECURITE", "ROLE_DIRECTION", "ROLE_ADMIN"],
    items: [
      { href: "/direction/planning", label: "Planning équipe", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
      { href: "/accueil/planning", label: "Mon planning", roles: ["ROLE_HOTE", "ROLE_CAISSIER", "ROLE_LAD", "ROLE_RAYON", "ROLE_SECURITE"] },
      { href: "/accueil/plan-de-caisse", label: "Plan de caisse", roles: ["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"] },
    ],
  },
  { href: "/direction/supervision-ia", label: "Supervision IA", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
  { href: "/admin/utilisateurs", label: "Utilisateurs", roles: ["ROLE_ADMIN"] },
  { href: "/admin/categories", label: "Catégories", roles: ["ROLE_ADMIN"] },
  {
    label: "Direction",
    roles: ["ROLE_DIRECTION", "ROLE_ADMIN"],
    items: [
      { href: "/direction/gestion-jobs", label: "Gestion Jobs", roles: ["ROLE_DIRECTION", "ROLE_ADMIN"] },
    ],
  },
];

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const { unreadCount } = useUnreadNotes();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenuPath, setOpenMenuPath] = useState(pathname);
  if (pathname !== openMenuPath) {
    setOpenMenuPath(pathname);
    setMenuOpen(false);
  }

  function visibleLinks(items: NavLink[]): NavLink[] {
    return items.filter((item) => !item.roles || hasRole(...item.roles));
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles))
    .map((item) => (isDropdown(item) ? { ...item, items: visibleLinks(item.items) } : item))
    .filter((item) => !isDropdown(item) || item.items.length > 0);

  return (
    <div className="flex min-h-screen flex-col print:block print:min-h-0 print:h-auto">
      <header className="sticky top-0 z-30 print:hidden">
        {/* Brand row */}
        <div className="bg-[var(--cf-blue)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
                <Image
                  src="/carrefour-logo.png"
                  alt="Carrefour"
                  width={32}
                  height={32}
                  className="h-full w-full object-contain"
                  priority
                />
              </span>
              <div className="min-w-0 leading-tight">
                <span className="block truncate text-base font-bold text-white">ShiftDesk</span>
                <span className="hidden text-[11px] font-medium text-blue-100 sm:block">
                  Gestion de l&apos;accueil
                </span>
              </div>
            </Link>

            {user && (
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href="/profil"
                  aria-label="Mon profil"
                  title="Mon profil"
                  className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/15 ${
                    pathname === "/profil" || pathname === `/profil/${user.id}`
                      ? "bg-white/15"
                      : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--cf-red)] text-xs font-bold text-white"
                  >
                    {userInitials(user)}
                  </span>
                  <div className="min-w-0 max-w-[7.5rem] leading-tight sm:max-w-[12rem] md:max-w-[200px]">
                    <p className="truncate text-sm font-semibold text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    {user.site && (
                      <p className="hidden truncate text-[11px] text-blue-100 sm:block">
                        {user.site.name}
                      </p>
                    )}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  className="hidden rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--cf-red)] sm:inline-flex"
                >
                  Déconnexion
                </button>

                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                  aria-expanded={menuOpen}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-[var(--cf-red)] md:hidden"
                >
                  {menuOpen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop tab bar */}
        <div className="border-b border-slate-200 bg-white shadow-sm">
          <nav
            aria-label="Navigation principale"
            className="cf-nav-track mx-auto hidden max-w-6xl flex-wrap gap-1 overflow-visible px-3 py-2 md:flex"
          >
            {visibleItems.map((item) =>
              isDropdown(item) ? (
                <NavDropdownMenu
                  key={item.label}
                  label={item.label}
                  items={item.items}
                  active={item.items.some((sub) => isActivePath(pathname, sub.href))}
                />
              ) : (
                <NavLinkItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isActivePath(pathname, item.href)}
                  badge={item.href === "/dashboard" ? unreadCount : 0}
                />
              ),
            )}
          </nav>

          {/* Mobile menu */}
          {menuOpen && (
            <nav
              aria-label="Navigation mobile"
              className="mx-auto flex max-w-6xl flex-col gap-1 px-3 py-3 md:hidden"
            >
              {user && (
                <Link
                  href="/profil"
                  aria-label="Mon profil"
                  className="mb-2 flex min-h-12 items-center gap-3 rounded-xl bg-[var(--cf-blue-light)] px-3 py-2.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--cf-red)] text-sm font-bold text-white">
                    {userInitials(user)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {user.firstName} {user.lastName}
                    </p>
                    {user.site && (
                      <p className="truncate text-xs text-slate-500">{user.site.name}</p>
                    )}
                  </div>
                </Link>
              )}

              {visibleItems.map((item) =>
                isDropdown(item) ? (
                  <div key={item.label} className="rounded-xl bg-slate-50 p-1.5">
                    <p className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--cf-blue)]">
                      {item.label}
                    </p>
                    {item.items.map((sub) => (
                      <MobileNavLink
                        key={sub.href}
                        href={sub.href}
                        label={sub.label}
                        active={pathname === sub.href}
                      />
                    ))}
                  </div>
                ) : (
                  <MobileNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={pathname === item.href}
                    badge={item.href === "/dashboard" ? unreadCount : 0}
                  />
                ),
              )}

              <button
                type="button"
                onClick={logout}
                className="mt-1 min-h-12 rounded-xl bg-[var(--cf-red)] px-4 py-3 text-left text-base font-semibold text-white"
              >
                Déconnexion
              </button>
            </nav>
          )}
        </div>

        <div className="cf-brand-stripe h-1 w-full" />
      </header>

      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-3 py-4 sm:px-4 sm:py-6 print:m-0 print:max-w-none print:flex-none print:gap-0 print:p-0">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-3 text-center text-xs text-slate-500 print:hidden">
        <span className="font-semibold text-[var(--cf-blue)]">ShiftDesk</span>
        {" — Gestion de l'accueil, des pauses et des plannings"}
      </footer>
    </div>
  );
}

function NavBadge({ count, active }: { count: number; active?: boolean }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
        active ? "bg-white text-[var(--cf-blue)]" : "bg-[var(--cf-red)] text-white"
      }`}
      aria-label={`${count} note${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`}
    >
      {label}
    </span>
  );
}

function MobileNavLink({
  href,
  label,
  active,
  badge = 0,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center rounded-lg px-3.5 py-3 text-base font-semibold transition ${
        active
          ? "bg-[var(--cf-blue)] text-white"
          : "text-slate-700 hover:bg-[var(--cf-blue-light)] hover:text-[var(--cf-blue-dark)]"
      }`}
    >
      <span className="inline-flex items-center">
        {label}
        <NavBadge count={badge} active={active} />
      </span>
    </Link>
  );
}

function NavLinkItem({
  href,
  label,
  active,
  badge = 0,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link href={href} className={`cf-nav-item ${active ? "cf-nav-item--active" : ""}`}>
      <span className="inline-flex items-center">
        {label}
        <NavBadge count={badge} active={active} />
      </span>
    </Link>
  );
}

function NavDropdownMenu({
  label,
  items,
  active,
}: {
  label: string;
  items: NavLink[];
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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
        aria-expanded={open}
        aria-haspopup="menu"
        className={`cf-nav-item ${active ? "cf-nav-item--active" : ""}`}
      >
        {label}
        <span
          className={`ml-1 text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-40 min-w-[210px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {items.map((item) => {
            const itemActive = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  itemActive
                    ? "bg-[var(--cf-blue)] text-white"
                    : "text-slate-700 hover:bg-[var(--cf-blue-light)] hover:text-[var(--cf-blue-dark)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
