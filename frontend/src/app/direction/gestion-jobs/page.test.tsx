import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithQuery } from "@/test/query";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/api";
import type { Job, User } from "@/lib/types";

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
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  };
});

import GestionJobsPage from "./page";

const mockedApi = api as unknown as { get: Mock; post: Mock; delete: Mock };

const NADIA: User = {
  id: 2,
  email: "nadia.direction@carrefour.local",
  firstName: "Nadia",
  lastName: "Direction",
  roles: ["ROLE_DIRECTEUR", "ROLE_DIRECTION"],
  active: true,
  job: {
    id: 1,
    code: "DIRECTEUR",
    label: "Directeur/rice",
    category: "DIRECTION",
    protected: true,
  },
};

const YANIS: User = {
  id: 4,
  email: "yanis.lad@carrefour.local",
  firstName: "Yanis",
  lastName: "Lad",
  roles: ["ROLE_LAD"],
  active: true,
  job: {
    id: 3,
    code: "LAD",
    label: "LAD",
    category: "ACCUEIL_CAISSE",
    protected: false,
  },
};

const JOBS: Job[] = [
  {
    id: 1,
    code: "DIRECTEUR",
    label: "Directeur/rice",
    category: "DIRECTION",
    protected: true,
    occupantCount: 1,
  },
  {
    id: 2,
    code: "CAISSIER",
    label: "Caissier(ère)",
    category: "ACCUEIL_CAISSE",
    protected: false,
    occupantCount: 0,
  },
  {
    id: 3,
    code: "LAD",
    label: "LAD",
    category: "ACCUEIL_CAISSE",
    protected: false,
    occupantCount: 1,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation((path: string) => {
    if (path === "/api/users") return Promise.resolve([NADIA, YANIS]);
    if (path === "/api/jobs") return Promise.resolve(JOBS);
    return Promise.resolve([]);
  });
  mockedApi.post.mockResolvedValue({
    id: 9,
    code: "ADJOINT_DE_DIRECTION",
    label: "Adjoint de direction",
    category: "DIRECTION",
    protected: false,
    occupantCount: 0,
  });
  mockedApi.delete.mockResolvedValue(undefined);
});

describe("Gestion Jobs", () => {
  it("présente Direction comme catégorie et Directeur/rice comme métier intouchable", async () => {
    const user = userEvent.setup();
    renderWithQuery(<GestionJobsPage />);

    expect(await screen.findByRole("heading", { name: "Gestion des jobs" })).toBeInTheDocument();
    expect(screen.getByText(/le retirer s’il n’y a encore aucun employé/)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Direction/ }));
    const job = await screen.findByText("Directeur/rice");
    const panel = job.closest("div") as HTMLElement;
    expect(within(panel).getByText("intouchable")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Retirer" })).toBeDisabled();
  });

  it("laisse un directeur ajouter un métier dans une catégorie", async () => {
    const user = userEvent.setup();
    renderWithQuery(<GestionJobsPage />);

    await screen.findByRole("heading", { name: "Gestion des jobs" });
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Catégorie"), "DIRECTION");
    await user.type(screen.getByLabelText("Métier"), "Adjoint de direction");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith("/api/jobs", {
        category: "DIRECTION",
        label: "Adjoint de direction",
      }),
    );
    expect(await screen.findByText("Poste ajouté.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Direction/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("affiche l'erreur du serveur si l'ajout échoue", async () => {
    const { ApiError } = await import("@/lib/api");
    mockedApi.post.mockRejectedValue(new ApiError("Catégorie inconnue.", 422));
    const user = userEvent.setup();
    renderWithQuery(<GestionJobsPage />);

    await user.type(await screen.findByLabelText("Métier"), "Poste fantôme");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(await screen.findByText("Catégorie inconnue.")).toBeInTheDocument();
  });

  it("permet de retirer un métier vacant, pas un métier encore occupé", async () => {
    const user = userEvent.setup();
    renderWithQuery(<GestionJobsPage />);

    await user.click(await screen.findByRole("button", { name: /Accueil \/ Caisse/ }));
    await screen.findByText("Caissier(ère)");

    const cashierRow = screen.getByText("Caissier(ère)").closest("li") as HTMLElement;
    expect(within(cashierRow).getByRole("button", { name: "Retirer" })).toBeEnabled();
    await user.click(within(cashierRow).getByRole("button", { name: "Retirer" }));

    const ladRow = screen.getByText("LAD").closest("li") as HTMLElement;
    expect(within(ladRow).getByRole("button", { name: "Retirer" })).toBeDisabled();
    expect(within(ladRow).getByLabelText("1 personne à ce poste")).toBeInTheDocument();

    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith("/api/jobs/2"));
    expect(await screen.findByText("Poste « Caissier(ère) » supprimé.")).toBeInTheDocument();
  });

  it("affiche l'erreur du serveur si le retrait échoue", async () => {
    const { ApiError } = await import("@/lib/api");
    mockedApi.delete.mockRejectedValue(
      new ApiError("Impossible de supprimer ce poste : 1 personne l'occupe encore.", 409),
    );
    const user = userEvent.setup();
    renderWithQuery(<GestionJobsPage />);

    await user.click(await screen.findByRole("button", { name: /Accueil \/ Caisse/ }));
    const cashierRow = (await screen.findByText("Caissier(ère)")).closest("li") as HTMLElement;
    await user.click(within(cashierRow).getByRole("button", { name: "Retirer" }));

    expect(
      await screen.findByText("Impossible de supprimer ce poste : 1 personne l'occupe encore."),
    ).toBeInTheDocument();
  });

  it("empile les catégories en menus déroulants", async () => {
    renderWithQuery(<GestionJobsPage />);

    expect(await screen.findByRole("button", { name: /Direction/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Direction/ })).toHaveTextContent("1 poste");
    });
    expect(screen.getByRole("button", { name: /Accueil \/ Caisse/ })).toHaveTextContent("2 postes");
    expect(screen.getByRole("button", { name: /Sécurité/ })).toHaveTextContent("0 poste");
    expect(screen.getByRole("button", { name: /Rayon/ })).toHaveTextContent("0 poste");
    expect(screen.queryByText("Directeur/rice")).not.toBeInTheDocument();
    expect(screen.queryByText("Caissier(ère)")).not.toBeInTheDocument();
  });
});
