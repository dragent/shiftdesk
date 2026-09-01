import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "@/test/query";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const nav = vi.hoisted(() => ({
  id: "8",
  replace: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: null as User | null,
  hasRole: (...roles: string[]) =>
    Boolean(auth.user?.roles?.some((role) => roles.includes(role))),
}));

vi.mock("@/components/RoleGuard", () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: nav.id }),
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: auth.user,
    refreshUser: vi.fn(),
    hasRole: auth.hasRole,
  }),
}));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  }
  return { ApiError, api: { get: vi.fn(), patch: vi.fn() } };
});

import UserProfilPage from "./page";

const mockedApi = api as unknown as { get: Mock; patch: Mock };

const LEA: User = {
  id: 8,
  email: "lea.martin@carrefour.local",
  firstName: "Léa",
  lastName: "Martin",
  roles: ["ROLE_HOTE"],
  active: true,
  phone: "06 11 22 33 44",
  contractMinutes: 2205,
  site: { id: 1, name: "Carrefour Market - Test", active: true },
};

const CLAIRE: User = {
  id: 2,
  email: "claire.bernard@carrefour.local",
  firstName: "Claire",
  lastName: "Bernard",
  roles: ["ROLE_DIRECTEUR", "ROLE_DIRECTION"],
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  nav.id = "8";
  auth.user = CLAIRE;
  mockedApi.get.mockImplementation((path: string) => {
    if (path === "/api/jobs") {
      return Promise.resolve([]);
    }
    return Promise.resolve(LEA);
  });
});

describe("fiche profil d'un employé", () => {
  it("charge la fiche d'un collègue pour la direction", async () => {
    renderWithQuery(<UserProfilPage />);

    expect(await screen.findByRole("heading", { name: "Martin Léa" })).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/users/8");
    expect(screen.getByText("06 11 22 33 44")).toBeInTheDocument();
    expect(screen.getByLabelText("Fonction")).toHaveValue("HOTE");
    expect(screen.getByLabelText("Heures par semaine")).toHaveValue(36);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("enregistre le poste et le contrat d'un collègue", async () => {
    mockedApi.patch.mockResolvedValue({
      ...LEA,
      roles: ["ROLE_LAD"],
      contractMinutes: 1800,
    });
    const user = userEvent.setup();
    renderWithQuery(<UserProfilPage />);

    await screen.findByRole("heading", { name: "Martin Léa" });
    await user.selectOptions(screen.getByLabelText("Fonction"), "LAD");
    const hours = screen.getByLabelText("Heures par semaine");
    await user.clear(hours);
    await user.type(hours, "30");
    await user.selectOptions(screen.getByLabelText("Minutes"), "0");
    await user.click(screen.getByRole("button", { name: "Enregistrer le poste" }));

    expect(mockedApi.patch).toHaveBeenCalledWith("/api/users/8", {
      role: "LAD",
      contractMinutes: 1800,
    });
    expect(await screen.findByText("Poste et contrat enregistrés.")).toBeInTheDocument();
  });

  it("affiche son propre profil sans appel API supplémentaire", async () => {
    nav.id = "2";
    auth.user = CLAIRE;
    renderWithQuery(<UserProfilPage />);

    expect(await screen.findByRole("heading", { name: "Mon profil" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Retour aux employés" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fonction")).toHaveValue("DIRECTEUR");
    expect(mockedApi.get).not.toHaveBeenCalledWith("/api/users/2");
    expect(mockedApi.get).toHaveBeenCalledWith("/api/jobs");
  });

  it("verrouille le poste de directeur/rice tout en laissant modifier le contrat", async () => {
    nav.id = "2";
    auth.user = CLAIRE;
    mockedApi.patch.mockResolvedValue({ ...CLAIRE, contractMinutes: 1800 });
    const user = userEvent.setup();
    renderWithQuery(<UserProfilPage />);

    await screen.findByRole("heading", { name: "Mon profil" });
    expect(screen.getByLabelText("Fonction")).toBeDisabled();
    expect(screen.getByText("Le poste de directeur/rice ne peut pas être retiré.")).toBeVisible();

    const hours = screen.getByLabelText("Heures par semaine");
    await user.clear(hours);
    await user.type(hours, "30");
    await user.selectOptions(screen.getByLabelText("Minutes"), "0");
    await user.click(screen.getByRole("button", { name: "Enregistrer le poste" }));

    // Le rôle n'est jamais envoyé : l'API refuserait de le remplacer.
    expect(mockedApi.patch).toHaveBeenCalledWith("/api/users/2", { contractMinutes: 1800 });
  });

  it("renvoie un caissier qui consulte la fiche d'un collègue", async () => {
    auth.user = { ...LEA, id: 9, roles: ["ROLE_CAISSIER"] };
    renderWithQuery(<UserProfilPage />);

    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/dashboard");
    });
    expect(mockedApi.get).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Martin Léa" })).toBeNull();
  });
});
