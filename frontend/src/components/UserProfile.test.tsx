import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "@/test/query";
import { UserProfile } from "./UserProfile";
import { api } from "@/lib/api";
import type { Job, User } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  api: { get: vi.fn() },
}));

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "direction@carrefour.local",
      firstName: "Nadia",
      lastName: "Direction",
      roles: ["ROLE_DIRECTION"],
      active: true,
    },
    logout: vi.fn(),
    hasRole: () => true,
  }),
}));

const mockedApi = api as unknown as { get: Mock };

beforeEach(() => {
  mockedApi.get.mockReset();
  mockedApi.get.mockResolvedValue([]);
});

function profile(overrides: Partial<User> = {}): User {
  return {
    id: 3,
    email: "lea.martin@carrefour.local",
    firstName: "Léa",
    lastName: "Martin",
    roles: ["ROLE_HOTE"],
    active: true,
    phone: "06 12 00 08 08",
    contractMinutes: 2205,
    site: { id: 1, name: "Carrefour Market - Test", active: true },
    ...overrides,
  };
}

describe("UserProfile", () => {
  it("affiche le profil de l'utilisateur connecté avec des champs modifiables", () => {
    renderWithQuery(<UserProfile profile={profile()} isOwn onSaveContact={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Mon profil" })).toBeInTheDocument();
    expect(screen.getByText("Martin Léa")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("lea.martin@carrefour.local");
    expect(screen.getByLabelText("Téléphone")).toHaveValue("06 12 00 08 08");
    expect(screen.getByRole("button", { name: "Enregistrer les coordonnées" })).toBeDisabled();
    expect(screen.queryByLabelText("Fonction")).toBeNull();
    expect(screen.getAllByText("Hôte(sse) d'accueil").length).toBeGreaterThan(0);
    expect(screen.getByText("36h45")).toBeInTheDocument();
    expect(screen.queryByText("Magasin")).toBeNull();
    expect(screen.getByText("En emploi")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "← Retour aux employés" })).toBeNull();
  });

  it("enregistre email et téléphone depuis son propre profil", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQuery(<UserProfile profile={profile()} isOwn onSaveContact={onSave} />);

    const email = screen.getByLabelText("Email");
    await user.clear(email);
    await user.type(email, "lea.nouveau@carrefour.local");
    const phone = screen.getByLabelText("Téléphone");
    await user.clear(phone);
    await user.type(phone, "07 00 00 00 00");
    await user.click(screen.getByRole("button", { name: "Enregistrer les coordonnées" }));

    expect(onSave).toHaveBeenCalledWith({
      email: "lea.nouveau@carrefour.local",
      phone: "07 00 00 00 00",
    });
    expect(await screen.findByText("Coordonnées enregistrées.")).toBeInTheDocument();
  });

  it("affiche la fiche d'un collègue en lecture seule", () => {
    renderWithQuery(
      <UserProfile
        profile={profile({
          firstName: "Sophie",
          lastName: "Durand",
          roles: ["ROLE_CAISSIER"],
          cashierNumber: "C-12",
        })}
        isOwn={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Durand Sophie" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Retour aux employés" })).toHaveAttribute(
      "href",
      "/direction/employes",
    );
    expect(screen.getByRole("link", { name: "lea.martin@carrefour.local" })).toHaveAttribute(
      "href",
      "mailto:lea.martin@carrefour.local",
    );
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    expect(screen.queryByLabelText("Fonction")).toBeNull();
    expect(screen.getByText("C-12")).toBeInTheDocument();
  });

  it("permet à la direction de changer le poste et le contrat d'un employé", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQuery(<UserProfile profile={profile()} isOwn={false} onSaveJob={onSave} />);

    expect(screen.getByLabelText("Fonction")).toHaveValue("HOTE");
    expect(screen.getByLabelText("Heures par semaine")).toHaveValue(36);
    expect(screen.getByLabelText("Minutes")).toHaveValue("45");

    await user.selectOptions(screen.getByLabelText("Fonction"), "LAD");
    const hours = screen.getByLabelText("Heures par semaine");
    await user.clear(hours);
    await user.type(hours, "30");
    await user.selectOptions(screen.getByLabelText("Minutes"), "0");
    await user.click(screen.getByRole("button", { name: "Enregistrer le poste" }));

    expect(onSave).toHaveBeenCalledWith({ role: "LAD", contractMinutes: 1800 });
    expect(await screen.findByText("Poste et contrat enregistrés.")).toBeInTheDocument();
  });

  it("n'envoie pas de poste métier tant qu'un administrateur n'en choisit pas un", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQuery(
      <UserProfile
        profile={profile({ roles: ["ROLE_ADMIN"], contractMinutes: 0 })}
        isOwn
        onSaveJob={onSave}
      />,
    );

    expect(screen.getByLabelText("Fonction")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Administrateur" })).toBeInTheDocument();

    const hours = screen.getByLabelText("Heures par semaine");
    await user.clear(hours);
    await user.type(hours, "35");
    await user.click(screen.getByRole("button", { name: "Enregistrer le poste" }));

    expect(onSave).toHaveBeenCalledWith({ contractMinutes: 2100 });
  });

  it("verrouille le poste d'un directeur/rice", () => {
    renderWithQuery(
      <UserProfile
        profile={profile({
          firstName: "Nadia",
          lastName: "Direction",
          roles: ["ROLE_DIRECTEUR", "ROLE_DIRECTION"],
        })}
        isOwn={false}
        onSaveJob={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Fonction")).toBeDisabled();
    expect(screen.getByText("Le poste de directeur/rice ne peut pas être retiré.")).toBeInTheDocument();
  });

  it("propose un métier du catalogue dans la fonction", async () => {
    const catalog: Job[] = [
      {
        id: 3,
        code: "HOTE",
        label: "Hôte(sse) d'accueil",
        category: "ACCUEIL_CAISSE",
        protected: false,
        grantsRole: "ROLE_HOTE",
      },
      {
        id: 9,
        code: "CHEF_DE_CAISSE",
        label: "Chef de caisse",
        category: "ACCUEIL_CAISSE",
        protected: false,
        grantsRole: "ROLE_CAISSIER",
      },
    ];
    mockedApi.get.mockResolvedValue(catalog);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQuery(<UserProfile profile={profile()} isOwn={false} onSaveJob={onSave} />);

    expect(await screen.findByRole("option", { name: "Chef de caisse" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Fonction"), "CHEF_DE_CAISSE");
    await user.click(screen.getByRole("button", { name: "Enregistrer le poste" }));

    expect(onSave).toHaveBeenCalledWith({ role: "CHEF_DE_CAISSE", contractMinutes: 2205 });
  });

  it("signale un téléphone manquant et un départ programmé", () => {
    renderWithQuery(
      <UserProfile
        profile={profile({ phone: null, dismissedAt: "2026-09-15" })}
        isOwn={false}
      />,
    );

    expect(screen.getByText("Non renseigné")).toBeInTheDocument();
    expect(screen.getByText("Départ le 15/09/2026")).toBeInTheDocument();
  });
});
