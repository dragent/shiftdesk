import { describe, expect, it } from "vitest";
import {
  buildStatusGroups,
  contractMinutesFromParts,
  countByCategory,
  MAX_CONTRACT_MINUTES,
  formatDateFR,
  fullName,
  groupKeyOf,
  isDepartureScheduled,
  matchesName,
  normalize,
  positionLabel,
  RECRUITMENT_CATEGORIES,
  sortByName,
  todayISO,
} from "./employees";
import type { User, UserRole } from "./types";

let nextId = 1;

function user(
  lastName: string,
  firstName: string,
  role: UserRole | null,
  overrides: Partial<User> = {},
): User {
  return {
    id: nextId++,
    email: `${firstName}.${lastName}@test.local`.toLowerCase(),
    firstName,
    lastName,
    roles: role ? [role] : [],
    active: true,
    ...overrides,
  };
}

describe("formatDateFR", () => {
  it("passe de l'ISO au format français", () => {
    expect(formatDateFR("2026-08-20")).toBe("20/08/2026");
  });

  it("ignore la partie horaire sans décaler le jour", () => {
    expect(formatDateFR("2026-01-01T23:30:00+02:00")).toBe("01/01/2026");
  });

  it("retourne la valeur telle quelle si elle n'est pas une date", () => {
    expect(formatDateFR("")).toBe("");
    expect(formatDateFR("bientôt")).toBe("bientôt");
  });
});

describe("isDepartureScheduled", () => {
  it("considère un départ futur comme programmé", () => {
    expect(isDepartureScheduled("2026-09-15", "2026-08-20")).toBe(true);
  });

  it("considère un départ du jour ou passé comme effectif", () => {
    expect(isDepartureScheduled("2026-08-20", "2026-08-20")).toBe(false);
    expect(isDepartureScheduled("2026-08-19", "2026-08-20")).toBe(false);
  });

  it("compare à aujourd'hui par défaut", () => {
    expect(isDepartureScheduled(todayISO())).toBe(false);
  });
});

describe("todayISO", () => {
  it("produit une date locale au format YYYY-MM-DD", () => {
    const iso = todayISO();
    const now = new Date();

    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(iso).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate(),
      ).padStart(2, "0")}`,
    );
  });
});

describe("contractMinutesFromParts", () => {
  it("convertit des heures et des quarts d'heure en minutes", () => {
    expect(contractMinutesFromParts(35)).toBe(2100);
    expect(contractMinutesFromParts(30, 0)).toBe(1800);
    expect(contractMinutesFromParts(36, 45)).toBe(2205);
    expect(contractMinutesFromParts("35", "15")).toBe(2115);
  });

  it("plafonne à 36 h 45", () => {
    expect(contractMinutesFromParts(40, 0)).toBe(MAX_CONTRACT_MINUTES);
    expect(contractMinutesFromParts(36, 45)).toBe(MAX_CONTRACT_MINUTES);
  });

  it("retourne zéro pour une saisie vide ou aberrante", () => {
    expect(contractMinutesFromParts("")).toBe(0);
    expect(contractMinutesFromParts("temps plein")).toBe(0);
    expect(contractMinutesFromParts(-10)).toBe(0);
    expect(contractMinutesFromParts(0, 0)).toBe(0);
  });
});

describe("normalize et matchesName", () => {
  it("ignore la casse et les accents", () => {
    expect(normalize("Benoît ÉLOI")).toBe("benoit eloi");
  });

  it("trouve un employé quel que soit l'ordre nom/prénom", () => {
    const employee = user("Lefèvre", "Amélie", "ROLE_CAISSIER");

    expect(matchesName(employee, normalize("amelie"))).toBe(true);
    expect(matchesName(employee, normalize("lefevre amelie"))).toBe(true);
    expect(matchesName(employee, normalize("amelie lefevre"))).toBe(true);
    expect(matchesName(employee, normalize("dupont"))).toBe(false);
  });

  it("accepte tout le monde quand le terme est vide", () => {
    expect(matchesName(user("Martin", "Léa", "ROLE_HOTE"), "")).toBe(true);
  });
});

describe("groupKeyOf et positionLabel", () => {
  it("rattache l'employé à son poste", () => {
    expect(groupKeyOf(user("Martin", "Léa", "ROLE_HOTE"))).toBe("HOTE");
    expect(groupKeyOf(user("Durand", "Sophie", "ROLE_CAISSIER"))).toBe("CAISSIER");
    expect(positionLabel(user("Durand", "Sophie", "ROLE_CAISSIER"))).toBe("Caisse");
  });

  it("range les comptes sans poste métier dans « Autres »", () => {
    expect(groupKeyOf(user("Admin", "Super", "ROLE_ADMIN"))).toBe("AUTRES");
    expect(groupKeyOf(user("Sans", "Rôle", null))).toBe("AUTRES");
    expect(positionLabel(user("Admin", "Super", "ROLE_ADMIN"))).toBe("Autres");
  });

  it("retient le premier poste connu quand le compte cumule les rôles", () => {
    const polyvalent = user("Petit", "Marc", null, {
      roles: ["ROLE_USER", "ROLE_LAD", "ROLE_CAISSIER"],
    });

    expect(groupKeyOf(polyvalent)).toBe("CAISSIER");
  });
});

describe("sortByName", () => {
  it("trie sur le nom puis le prénom, sans muter la liste d'origine", () => {
    const employees = [
      user("Zola", "Émile", "ROLE_RAYON"),
      user("Martin", "Paul", "ROLE_RAYON"),
      user("Martin", "Alice", "ROLE_RAYON"),
    ];

    expect(sortByName(employees).map(fullName)).toEqual([
      "Martin Alice",
      "Martin Paul",
      "Zola Émile",
    ]);
    expect(employees.map(fullName)[0]).toBe("Zola Émile");
  });
});

describe("countByCategory", () => {
  it("compte les employés de chaque catégorie, licenciés compris", () => {
    const counts = countByCategory([
      user("Durand", "Sophie", "ROLE_CAISSIER"),
      user("Martin", "Léa", "ROLE_HOTE"),
      user("Petit", "Marc", "ROLE_LAD", { active: false }),
      user("Bernard", "Claire", "ROLE_DIRECTION"),
      user("Admin", "Super", "ROLE_ADMIN"),
    ]);

    expect(counts).toEqual({
      DIRECTION: 1,
      ACCUEIL_CAISSE: 3,
      SECURITE: 0,
      RAYON: 0,
      AUTRES: 1,
    });
  });
});

describe("buildStatusGroups", () => {
  const team = [
    user("Durand", "Sophie", "ROLE_CAISSIER"),
    user("Bernard", "Claire", "ROLE_CAISSIER"),
    user("Martin", "Léa", "ROLE_HOTE"),
    user("Bernard", "Hugo", "ROLE_RAYON"),
    user("Petit", "Marc", "ROLE_LAD", { active: false, dismissedAt: "2026-07-01" }),
  ];

  it("sépare les employés en poste des licenciés", () => {
    const { employed, dismissed } = buildStatusGroups(team, { category: null, searchTerm: "" });

    expect(employed.map((group) => group.key)).toEqual(["CAISSIER", "HOTE", "RAYON"]);
    expect(employed[0].users.map(fullName)).toEqual(["Bernard Claire", "Durand Sophie"]);
    expect(dismissed.map((group) => group.key)).toEqual(["LAD"]);
  });

  it("ne garde que les postes de la catégorie sélectionnée", () => {
    const { employed, dismissed } = buildStatusGroups(team, {
      category: "ACCUEIL_CAISSE",
      searchTerm: "",
    });

    expect(employed.map((group) => group.key)).toEqual(["CAISSIER", "HOTE"]);
    expect(dismissed.map((group) => group.key)).toEqual(["LAD"]);
  });

  it("ne renvoie aucun groupe quand la catégorie est vide", () => {
    const { employed, dismissed } = buildStatusGroups(team, {
      category: "SECURITE",
      searchTerm: "",
    });

    expect(employed).toEqual([]);
    expect(dismissed).toEqual([]);
  });

  it("fait primer la recherche sur la catégorie sélectionnée", () => {
    const { employed } = buildStatusGroups(team, {
      category: "SECURITE",
      searchTerm: normalize("lea"),
    });

    expect(employed.map((group) => group.key)).toEqual(["HOTE"]);
    expect(employed[0].users.map(fullName)).toEqual(["Martin Léa"]);
  });

  it("cherche aussi parmi les licenciés", () => {
    const { employed, dismissed } = buildStatusGroups(team, {
      category: null,
      searchTerm: normalize("marc"),
    });

    expect(employed).toEqual([]);
    expect(dismissed[0].users.map(fullName)).toEqual(["Petit Marc"]);
  });

  it("remonte les homonymes de tous les postes", () => {
    const { employed } = buildStatusGroups(team, {
      category: null,
      searchTerm: normalize("bernard"),
    });

    expect(employed.map((group) => group.key)).toEqual(["CAISSIER", "RAYON"]);
  });
});

describe("RECRUITMENT_CATEGORIES", () => {
  it("propose les postes groupés par catégorie, sans « Autres »", () => {
    expect(RECRUITMENT_CATEGORIES.map((category) => category.key)).toEqual([
      "DIRECTION",
      "ACCUEIL_CAISSE",
      "SECURITE",
      "RAYON",
    ]);
  });

  it("détaille les postes d'une catégorie qui en compte plusieurs", () => {
    const accueil = RECRUITMENT_CATEGORIES.find((c) => c.key === "ACCUEIL_CAISSE");

    expect(accueil?.jobs.map((job) => job.value)).toEqual(["CAISSIER", "LAD", "HOTE"]);
    expect(accueil?.jobs[0].label).toBe("Caissier(ère)");
  });

  it("garde un poste unique directement sélectionnable", () => {
    const direction = RECRUITMENT_CATEGORIES.find((c) => c.key === "DIRECTION");

    expect(direction?.jobs).toHaveLength(1);
    expect(direction?.jobs[0]).toEqual({ value: "DIRECTION", label: "Direction" });
  });
});
