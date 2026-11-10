import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import type { User } from "@/lib/types";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("@/lib/UnreadNotesContext", () => ({
  useUnreadNotes: () => ({ unreadCount: 0 }),
}));

const CLAIRE: User = {
  id: 2,
  email: "claire.bernard@carrefour.local",
  firstName: "Claire",
  lastName: "Bernard",
  roles: ["ROLE_DIRECTION"],
  active: true,
  site: { id: 1, name: "Carrefour Market - Test", active: true },
};

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: CLAIRE,
    logout: vi.fn(),
    hasRole: (...roles: string[]) => roles.includes("ROLE_DIRECTION"),
  }),
}));

describe("AppShell — accès au profil", () => {
  it("relie le nom de l'utilisateur connecté à son profil", () => {
    pathname.value = "/dashboard";
    render(
      <AppShell>
        <p>contenu</p>
      </AppShell>,
    );

    const links = screen.getAllByRole("link", { name: "Mon profil" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/profil");
    }
    expect(screen.getAllByText("Claire Bernard").length).toBeGreaterThan(0);
  });

  it("affiche le lien Annexe pour la direction", () => {
    pathname.value = "/dashboard";
    render(
      <AppShell>
        <p>contenu</p>
      </AppShell>,
    );

    const links = screen.getAllByRole("link", { name: "Annexe" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/annexe");
    }
  });
});

describe("AppShell — dropdown Direction", () => {
  it("ouvre Gestion Jobs depuis le dernier onglet de la barre", async () => {
    pathname.value = "/dashboard";
    render(
      <AppShell>
        <p>contenu</p>
      </AppShell>,
    );

    const tabs = screen.getByRole("navigation", { name: "Navigation principale" });
    const trigger = within(tabs).getByRole("button", { name: /Direction/ });
    expect(within(tabs).getAllByRole("button").at(-1)).toBe(trigger);

    await userEvent.click(trigger);

    expect(within(tabs).getByRole("menuitem", { name: "Gestion Jobs" })).toHaveAttribute(
      "href",
      "/direction/gestion-jobs",
    );
  });
});
