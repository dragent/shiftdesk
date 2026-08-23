import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/employees";
import type { Site, User, UserRole } from "@/lib/types";

// The page is only reachable by management: the guard and the shell are
// replaced by their content so the test stays focused on the employee list.
vi.mock("@/components/RoleGuard", () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

  return {
    ApiError,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

vi.mock("@/lib/employees", async () => {
  const actual = await vi.importActual<typeof import("@/lib/employees")>("@/lib/employees");
  return {
    ...actual,
    isDevToolsEnabled: vi.fn(() => true),
  };
});

import EmployesPage from "./page";
import { isDevToolsEnabled } from "@/lib/employees";

const mockedApi = api as unknown as { get: Mock; post: Mock; patch: Mock; delete: Mock };
const mockedIsDevToolsEnabled = isDevToolsEnabled as unknown as Mock;

let nextId = 1;

function employee(
  lastName: string,
  firstName: string,
  role: UserRole,
  overrides: Partial<User> = {},
): User {
  return {
    id: nextId++,
    email: `${firstName}.${lastName}@carrefour.local`.toLowerCase(),
    firstName,
    lastName,
    roles: [role],
    active: true,
    ...overrides,
  };
}

const SOPHIE = employee("Durand", "Sophie", "ROLE_CAISSIER", { phone: "06 12 00 08 08" });
const LEA = employee("Martin", "Léa", "ROLE_HOTE");
const CLAIRE = employee("Bernard", "Claire", "ROLE_DIRECTION");
const KARIM = employee("Benali", "Karim", "ROLE_CAISSIER", { dismissedAt: "2026-09-15" });
const MARC = employee("Petit", "Marc", "ROLE_LAD", { active: false, dismissedAt: "2026-07-01" });
const JULIE = employee("Martin", "Julie", "ROLE_CAISSIER", {
  active: false,
  dismissedAt: "2026-06-15",
});

const TEAM = [SOPHIE, LEA, CLAIRE, KARIM, MARC, JULIE];
const SITES: Site[] = [{ id: 7, name: "Carrefour Market - Test", active: true }];

function renderPage(users: User[] = TEAM, sites: Site[] = SITES) {
  mockedApi.get.mockImplementation((path: string) =>
    Promise.resolve(path === "/api/users" ? users : sites),
  );
  render(<EmployesPage />);
  return userEvent.setup();
}

/** Card of the "En emploi" or "Licenciés" section, to scope the queries. */
function card(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;
}

/** Every row action is named after its employee, hence unique on the page. */
function action(label: string): HTMLElement {
  return screen.getByRole("button", { name: label });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.post.mockResolvedValue(undefined);
  mockedApi.patch.mockResolvedValue(undefined);
  mockedApi.delete.mockResolvedValue(undefined);
  mockedIsDevToolsEnabled.mockReturnValue(true);
});

describe("liste des employés", () => {
  it("répartit l'équipe par statut puis par poste", async () => {
    renderPage();

    const employed = await screen.findByRole("heading", { name: "En emploi" });
    const employedCard = employed.closest("section") as HTMLElement;

    expect(within(employedCard).getAllByRole("heading", { level: 3 }).map((h) => h.textContent))
      .toEqual(["Direction", "Caissiers", "Hôtes / hôtesses d'accueil"]);
    expect(within(employedCard).getByText("Durand Sophie")).toBeInTheDocument();
    expect(within(employedCard).getByText("06 12 00 08 08")).toBeInTheDocument();

    const dismissedCard = card("Licenciés");
    expect(within(dismissedCard).getByText("Petit Marc")).toBeInTheDocument();
    expect(within(dismissedCard).getByText("Licencié le 01/07/2026")).toBeInTheDocument();
    expect(within(dismissedCard).queryByText("Durand Sophie")).toBeNull();
  });

  it("signale un téléphone manquant", async () => {
    renderPage();

    expect(await screen.findByText("Durand Sophie")).toBeInTheDocument();
    expect(screen.getAllByText("Téléphone non renseigné")).toHaveLength(5);
  });

  it("garde en poste un départ programmé et propose de l'annuler", async () => {
    renderPage();

    expect(await screen.findByText("Benali Karim")).toBeInTheDocument();
    const employedCard = card("En emploi");
    expect(within(employedCard).getByText("Départ le 15/09/2026")).toBeInTheDocument();
    expect(action("Annuler le départ de Benali Karim")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Licencier Benali Karim" })).toBeNull();
  });

  it("distingue le recrutement d'un nouvel employé de la réembauche", async () => {
    renderPage();

    await screen.findByText("Petit Marc");
    // Both buttons read « Recrutement », as asked, but they are told apart by
    // their accessible name.
    expect(screen.getAllByText("Recrutement")).toHaveLength(3);
    expect(action("Recruter un nouvel employé")).toBeInTheDocument();
    expect(action("Réembaucher Petit Marc")).toBeInTheDocument();
  });

  it("compte les employés de chaque catégorie", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /Accueil \/ Caisse/ })).toHaveTextContent("5");
    expect(screen.getByRole("button", { name: /Direction/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Sécurité/ })).toBeDisabled();
  });
});

describe("filtres", () => {
  it("n'affiche que la catégorie sélectionnée, puis tout le monde au second clic", async () => {
    const user = renderPage();

    const filter = await screen.findByRole("button", { name: /Direction/ });
    await user.click(filter);

    expect(screen.queryByText("Durand Sophie")).toBeNull();
    expect(screen.getByText("Bernard Claire")).toBeInTheDocument();

    await user.click(filter);

    expect(screen.getByText("Durand Sophie")).toBeInTheDocument();
  });

  it("fait primer la recherche par nom sur la catégorie", async () => {
    const user = renderPage();

    await user.click(await screen.findByRole("button", { name: /Direction/ }));
    await user.type(screen.getByRole("combobox"), "sophie");

    const employedCard = card("En emploi");
    expect(within(employedCard).getByText("Durand Sophie")).toBeInTheDocument();
    expect(within(employedCard).queryByText("Bernard Claire")).toBeNull();
    expect(screen.getByText(/Recherche sur toutes les catégories/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Direction/ })).toBeDisabled();
  });

  it("annonce l'absence de résultat dans les deux sections", async () => {
    const user = renderPage();

    await user.type(await screen.findByRole("combobox"), "inconnu");

    expect(screen.getByText("Aucun employé en poste ne correspond à cette recherche.")).toBeInTheDocument();
    expect(screen.getByText("Aucun employé licencié ne correspond à cette recherche.")).toBeInTheDocument();
  });
});

describe("licenciement", () => {
  it("enregistre un départ immédiat à la date du jour", async () => {
    const user = renderPage();

    await screen.findByText("Durand Sophie");
    await user.click(action("Licencier Durand Sophie"));

    expect(screen.getByLabelText("Date du licenciement")).toHaveValue(todayISO());
    expect(screen.getByText("Le départ prend effet immédiatement.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Licencier" }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/api/users/${SOPHIE.id}`, {
        dismissedAt: todayISO(),
      }),
    );
    expect(await screen.findByText(/a été licencié\(e\) au/)).toBeInTheDocument();
  });

  it("annonce un maintien en poste jusqu'à une date future", async () => {
    const user = renderPage();

    await screen.findByText("Durand Sophie");
    await user.click(action("Licencier Durand Sophie"));

    const dateField = screen.getByLabelText("Date du licenciement");
    await user.clear(dateField);
    await user.type(dateField, "2026-12-24");

    expect(
      screen.getByText("Sophie reste en poste et planifiable jusqu'au 24/12/2026."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Licencier" }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/api/users/${SOPHIE.id}`, {
        dismissedAt: "2026-12-24",
      }),
    );
    expect(await screen.findByText(/quittera l'entreprise le 24\/12\/2026/)).toBeInTheDocument();
  });

  it("annule un départ programmé", async () => {
    const user = renderPage();

    await screen.findByText("Benali Karim");
    await user.click(action("Annuler le départ de Benali Karim"));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/api/users/${KARIM.id}`, {
        dismissedAt: null,
      }),
    );
  });

  it("réactive un compte licencié depuis la section licenciés", async () => {
    const user = renderPage();

    await screen.findByText("Petit Marc");
    await user.click(action("Réembaucher Petit Marc"));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/api/users/${MARC.id}`, { active: true }),
    );
  });

  it("propose la suppression définitive d'un caissier licencié en environnement de développement", async () => {
    const user = renderPage();
    window.confirm = vi.fn(() => true);

    await screen.findByText("Martin Julie");
    expect(action("Supprimer définitivement Martin Julie")).toBeInTheDocument();
    // Non-cashier dismissed employees keep recruitment only.
    expect(screen.queryByRole("button", { name: /Supprimer définitivement Petit/ })).toBeNull();
    // Still employed (even with a scheduled departure) must not be deletable here.
    expect(screen.queryByRole("button", { name: /Supprimer définitivement Benali/ })).toBeNull();

    await user.click(action("Supprimer définitivement Martin Julie"));

    await waitFor(() =>
      expect(mockedApi.delete).toHaveBeenCalledWith(`/api/users/${JULIE.id}`),
    );
  });

  it("masque la suppression hors environnement de développement", async () => {
    mockedIsDevToolsEnabled.mockReturnValue(false);
    renderPage();

    await screen.findByText("Petit Marc");
    expect(screen.queryByRole("button", { name: /Supprimer définitivement/ })).toBeNull();
  });

  it("affiche l'erreur du serveur sans fermer la liste", async () => {
    const { ApiError } = await import("@/lib/api");
    mockedApi.patch.mockRejectedValue(new ApiError("Licenciement impossible.", 422));
    const user = renderPage();

    await screen.findByText("Benali Karim");
    await user.click(action("Annuler le départ de Benali Karim"));

    expect(await screen.findByText("Licenciement impossible.")).toBeInTheDocument();
  });
});

describe("absences", () => {
  it("déclare un arrêt de travail sur la journée complète du magasin", async () => {
    const user = renderPage();

    await screen.findByText("Durand Sophie");
    await user.click(action("Déclarer un arrêt de travail pour Durand Sophie"));

    expect(screen.getByLabelText("Heure de début")).toHaveValue("07:00");
    expect(screen.getByLabelText("Heure de fin")).toHaveValue("20:15");

    await user.click(screen.getByRole("button", { name: "Valider" }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith("/api/absences", {
        userId: SOPHIE.id,
        reason: "ARRET_TRAVAIL",
        startDate: todayISO(),
        endDate: todayISO(),
        startTime: "07:00",
        endTime: "20:15",
      }),
    );
  });

  it("déclare des vacances sans horaires", async () => {
    const user = renderPage();

    await screen.findByText("Durand Sophie");
    await user.click(action("Déclarer des vacances pour Durand Sophie"));

    expect(screen.queryByLabelText("Heure de début")).toBeNull();

    const endDate = screen.getByLabelText("Date de fin");
    await user.clear(endDate);
    await user.type(endDate, "2026-08-30");
    await user.click(screen.getByRole("button", { name: "Valider" }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith("/api/absences", {
        userId: SOPHIE.id,
        reason: "CONGE",
        startDate: todayISO(),
        endDate: "2026-08-30",
      }),
    );
    expect(await screen.findByText("Vacances enregistrées pour Sophie Durand.")).toBeInTheDocument();
  });
});

describe("recrutement", () => {
  async function openRecruitment(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Recruter un nouvel employé" }));
  }

  it("groupe les postes par catégorie et ne rend sélectionnables que les métiers", async () => {
    const user = renderPage();
    await openRecruitment(user);

    const select = screen.getByLabelText(/Poste/) as HTMLSelectElement;

    expect([...select.querySelectorAll("optgroup")].map((group) => group.label)).toEqual([
      "Accueil / Caisse",
    ]);
    expect([...select.querySelectorAll(":scope > option")].map((option) => option.value)).toEqual([
      "DIRECTION",
      "SECURITE",
      "RAYON",
    ]);
    expect(select).toHaveValue("CAISSIER");
  });

  it("propose 36 h 45 par défaut, avec quarts d'heure et plafond 36 h 45", async () => {
    const user = renderPage();
    await openRecruitment(user);

    const hours = screen.getByLabelText("Heures par semaine");
    const minutes = screen.getByLabelText("Minutes");
    expect(hours).toHaveValue(36);
    expect(hours).toHaveAttribute("max", "36");
    expect(minutes).toHaveValue("45");
    expect([...minutes.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "0",
      "15",
      "30",
      "45",
    ]);

    await user.type(screen.getByLabelText("Prénom"), "Julie");
    await user.type(screen.getByLabelText("Nom"), "Moreau");
    await user.type(screen.getByLabelText("Email"), "julie.moreau@carrefour.local");
    await user.click(screen.getByRole("button", { name: "Recruter" }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith(
        "/api/users",
        expect.objectContaining({ contractMinutes: 2205 }),
      ),
    );
  });

  it("masque le sélecteur de site quand le magasin est unique", async () => {
    const user = renderPage();
    await openRecruitment(user);

    expect(screen.queryByLabelText("Site")).toBeNull();
  });

  it("propose le choix du site dès qu'il y en a plusieurs", async () => {
    const user = renderPage(TEAM, [
      ...SITES,
      { id: 8, name: "Carrefour City - Test", active: true },
    ]);
    await openRecruitment(user);

    expect(screen.getByLabelText("Site")).toHaveValue("7");
  });

  it("crée le compte du nouvel employé sur le site du magasin", async () => {
    const user = renderPage();
    await openRecruitment(user);

    await user.type(screen.getByLabelText("Prénom"), "Julie");
    await user.type(screen.getByLabelText("Nom"), "Moreau");
    await user.type(screen.getByLabelText("Email"), "julie.moreau@carrefour.local");
    await user.type(screen.getByLabelText("Téléphone"), "06 11 22 33 44");
    await user.selectOptions(screen.getByLabelText(/Poste/), "HOTE");
    await user.clear(screen.getByLabelText("Heures par semaine"));
    await user.type(screen.getByLabelText("Heures par semaine"), "36");
    await user.selectOptions(screen.getByLabelText("Minutes"), "45");
    await user.click(screen.getByRole("button", { name: "Recruter" }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith("/api/users", {
        firstName: "Julie",
        lastName: "Moreau",
        email: "julie.moreau@carrefour.local",
        phone: "06 11 22 33 44",
        role: "HOTE",
        contractMinutes: 2205,
        siteId: 7,
      }),
    );
    expect(
      await screen.findByText(
        "Julie Moreau a été recruté(e). Un email avec les identifiants a été envoyé.",
      ),
    ).toBeInTheDocument();
  });

  it("envoie un téléphone nul quand le champ est laissé vide", async () => {
    const user = renderPage();
    await openRecruitment(user);

    await user.type(screen.getByLabelText("Prénom"), "Julie");
    await user.type(screen.getByLabelText("Nom"), "Moreau");
    await user.type(screen.getByLabelText("Email"), "julie.moreau@carrefour.local");
    await user.click(screen.getByRole("button", { name: "Recruter" }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith(
        "/api/users",
        expect.objectContaining({ phone: null }),
      ),
    );
  });
});
