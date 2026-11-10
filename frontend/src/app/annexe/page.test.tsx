import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "@/test/query";
import { api } from "@/lib/api";
import type { AnnexeFile, AnnexeWebsite, User } from "@/lib/types";

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
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: auth.user,
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
  return {
    ApiError,
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  };
});

import AnnexePage from "./page";

const mockedApi = api as unknown as { get: Mock; post: Mock; delete: Mock };

const CLAIRE: User = {
  id: 2,
  email: "claire.bernard@carrefour.local",
  firstName: "Claire",
  lastName: "Bernard",
  roles: ["ROLE_DIRECTION"],
  active: true,
};

const LEA: User = {
  id: 8,
  email: "lea.martin@carrefour.local",
  firstName: "Léa",
  lastName: "Martin",
  roles: ["ROLE_HOTE"],
  active: true,
};

const SOPHIE: User = {
  id: 3,
  email: "sophie.durand@carrefour.local",
  firstName: "Sophie",
  lastName: "Durand",
  roles: ["ROLE_CAISSIER"],
  active: true,
};

const WEBSITE: AnnexeWebsite = {
  id: 1,
  name: "Caroline",
  url: "https://intranet.example/caroline",
  allowedRoles: ["ROLE_HOTE"],
  createdAt: "2026-09-01T10:00:00+02:00",
};

const FILE: AnnexeFile = {
  id: 4,
  name: "consigne-accueil.pdf",
  createdBy: LEA,
  createdAt: "2026-09-01T10:00:00+02:00",
};

function mockLists(websites: AnnexeWebsite[] = [], files: AnnexeFile[] = []) {
  mockedApi.get.mockImplementation((path: string) => {
    if (path === "/api/annexe/websites") return Promise.resolve(websites);
    if (path === "/api/annexe/files") return Promise.resolve(files);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = CLAIRE;
  mockLists();
});

describe("page Annexe", () => {
  it("laisse la direction ajouter un site web avec des métiers", async () => {
    mockedApi.post.mockResolvedValue(WEBSITE);
    const user = userEvent.setup();
    renderWithQuery(<AnnexePage />);

    await user.type(screen.getByLabelText("Nom du site"), "Caroline");
    await user.type(screen.getByLabelText("Adresse"), "intranet.example/caroline");
    await user.click(screen.getByRole("checkbox", { name: "Hôte(sse) d'accueil" }));
    await user.click(screen.getByRole("button", { name: "Ajouter le site" }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/annexe/websites", {
        name: "Caroline",
        url: "intranet.example/caroline",
        allowedRoles: ["ROLE_HOTE"],
      });
    });
  });

  it("laisse l'accueil ajouter un fichier mais pas un site web", async () => {
    auth.user = LEA;
    mockLists([], [FILE]);
    mockedApi.post.mockResolvedValue(FILE);
    const user = userEvent.setup();
    renderWithQuery(<AnnexePage />);

    expect(screen.queryByLabelText("Nom du site")).not.toBeInTheDocument();
    expect(await screen.findByText("consigne-accueil.pdf")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nom du fichier"), "planning-caisse.xlsx");
    await user.click(screen.getByRole("button", { name: "Ajouter le fichier" }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/annexe/files", {
        name: "planning-caisse.xlsx",
      });
    });
  });

  it("affiche les sites web au caissier sans formulaire d'ajout", async () => {
    auth.user = SOPHIE;
    mockLists([WEBSITE]);
    renderWithQuery(<AnnexePage />);

    expect(await screen.findByRole("link", { name: "Caroline" })).toHaveAttribute(
      "href",
      "https://intranet.example/caroline",
    );
    expect(screen.queryByLabelText("Nom du site")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nom du fichier")).not.toBeInTheDocument();
    expect(mockedApi.get).not.toHaveBeenCalledWith("/api/annexe/files");
  });
});
