import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "@/test/query";
import type { User } from "@/lib/types";

const SOPHIE: User = {
  id: 4,
  email: "sophie.durand@carrefour.local",
  firstName: "Sophie",
  lastName: "Durand",
  roles: ["ROLE_CAISSIER"],
  active: true,
  phone: "06 12 00 08 08",
  contractMinutes: 1800,
  site: { id: 1, name: "Carrefour Market - Test", active: true },
};

vi.mock("@/components/RoleGuard", () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: SOPHIE,
    refreshUser: vi.fn(),
    hasRole: (...roles: string[]) => roles.includes("ROLE_CAISSIER"),
  }),
}));

import ProfilPage from "./page";

describe("page Mon profil", () => {
  it("affiche la fiche de l'utilisateur connecté", () => {
    renderWithQuery(<ProfilPage />);

    expect(screen.getByRole("heading", { name: "Mon profil" })).toBeInTheDocument();
    expect(screen.getByText("Durand Sophie")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("sophie.durand@carrefour.local");
    expect(screen.getByText("30h")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fonction")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enregistrer le poste" })).toBeNull();
  });
});
