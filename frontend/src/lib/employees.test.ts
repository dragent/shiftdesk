import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStatusGroups,
  CATEGORY_DEFS,
  contractMinutesFromParts,
  contractPartsFromMinutes,
  countByCategory,
  countByJob,
  isDevToolsEnabled,
  JOB_CATEGORY_DEFS,
  MAX_CONTRACT_MINUTES,
  formatDateFR,
  canViewUserProfile,
  canEditJobAndContract,
  selectableJobKey,
  fullName,
  groupKeyOf,
  jobTitle,
  isDepartureScheduled,
  isUnschedulableOnDate,
  matchesName,
  normalize,
  positionLabel,
  userInitials,
  RECRUITMENT_CATEGORIES,
  recruitmentCategoriesFromJobs,
  categoryDefsFromJobs,
  sortByName,
  todayISO,
} from "./employees";
import type { Job, User, UserRole } from "./types";

afterEach(() => {
  vi.unstubAllEnvs();
});

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

describe("isUnschedulableOnDate", () => {
  it("autorise les jours avant le licenciement", () => {
    const u = user("Martin", "Alice", "ROLE_CAISSIER", {
      dismissedAt: "2026-08-25",
    });
    expect(isUnschedulableOnDate(u, "2026-08-24")).toBe(false);
  });

  it("bloque le jour du licenciement et les suivants", () => {
    const u = user("Martin", "Alice", "ROLE_CAISSIER", {
      dismissedAt: "2026-08-25",
    });
    expect(isUnschedulableOnDate(u, "2026-08-25")).toBe(true);
    expect(isUnschedulableOnDate(u, "2026-08-26")).toBe(true);
  });

  it("bloque les comptes inactifs même sans date", () => {
    const u = user("Martin", "Alice", "ROLE_CAISSIER", { active: false });
    expect(isUnschedulableOnDate(u, "2026-08-20")).toBe(true);
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

describe("contractPartsFromMinutes", () => {
  it("découpe un contrat en heures et quarts d'heure", () => {
    expect(contractPartsFromMinutes(2205)).toEqual({ hours: 36, extraMinutes: 45 });
    expect(contractPartsFromMinutes(1800)).toEqual({ hours: 30, extraMinutes: 0 });
    expect(contractPartsFromMinutes(2115)).toEqual({ hours: 35, extraMinutes: 15 });
  });

  it("ramène un reliquat hors quart d'heure au cran le plus proche", () => {
    expect(contractPartsFromMinutes(1820).extraMinutes).toBe(15);
  });
});

describe("isDevToolsEnabled", () => {
  it("s'active en NODE_ENV development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", undefined);
    expect(isDevToolsEnabled()).toBe(true);
  });

  it("reste désactivé en production hors localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", undefined);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "shift.carrefour.fr" },
    });

    expect(isDevToolsEnabled()).toBe(false);
  });

  it("s'active sur localhost même en build production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", undefined);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "localhost" },
    });

    expect(isDevToolsEnabled()).toBe(true);
  });

  it("peut être forcé par NEXT_PUBLIC_ENABLE_DEV_TOOLS", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", "1");
    expect(isDevToolsEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", "0");
    expect(isDevToolsEnabled()).toBe(false);
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

describe("jobTitle", () => {
  it("donne l'intitulé du poste au singulier", () => {
    expect(jobTitle(user("Durand", "Sophie", "ROLE_CAISSIER"))).toBe("Caissier(ère)");
    expect(jobTitle(user("Martin", "Léa", "ROLE_HOTE"))).toBe("Hôte(sse) d'accueil");
    expect(jobTitle(user("Bernard", "Claire", "ROLE_DIRECTEUR"))).toBe("Directeur/rice");
  });

  it("distingue l'administrateur des comptes sans poste", () => {
    expect(jobTitle(user("Admin", "Super", "ROLE_ADMIN"))).toBe("Administrateur");
    expect(jobTitle(user("Sans", "Rôle", null))).toBe("Autre");
  });
});

describe("userInitials", () => {
  it("prend la première lettre du prénom et du nom", () => {
    expect(userInitials({ firstName: "Sophie", lastName: "Durand" })).toBe("SD");
  });

  it("reste utilisable si un des noms est vide", () => {
    expect(userInitials({ firstName: "Sophie", lastName: "" })).toBe("S");
    expect(userInitials({ firstName: "", lastName: "" })).toBe("?");
  });
});

describe("canViewUserProfile", () => {
  it("autorise chacun à voir sa propre fiche", () => {
    const cashier = user("Durand", "Sophie", "ROLE_CAISSIER");
    expect(canViewUserProfile(cashier, cashier.id)).toBe(true);
  });

  it("réserve les fiches des collègues à la direction et à l'admin", () => {
    const cashier = user("Durand", "Sophie", "ROLE_CAISSIER");
    const colleague = user("Martin", "Léa", "ROLE_HOTE");
    const direction = user("Bernard", "Claire", "ROLE_DIRECTION");
    const admin = user("Admin", "Super", "ROLE_ADMIN");

    expect(canViewUserProfile(cashier, colleague.id)).toBe(false);
    expect(canViewUserProfile(direction, colleague.id)).toBe(true);
    expect(canViewUserProfile(admin, colleague.id)).toBe(true);
  });
});

describe("canEditJobAndContract", () => {
  it("n'autorise que la direction et l'admin", () => {
    expect(canEditJobAndContract(user("Durand", "Sophie", "ROLE_CAISSIER"))).toBe(false);
    expect(canEditJobAndContract(user("Bernard", "Claire", "ROLE_DIRECTION"))).toBe(true);
    expect(canEditJobAndContract(user("Admin", "Super", "ROLE_ADMIN"))).toBe(true);
  });
});

describe("selectableJobKey", () => {
  it("renvoie la clé de recrutement du poste métier", () => {
    expect(selectableJobKey(user("Durand", "Sophie", "ROLE_CAISSIER"))).toBe("CAISSIER");
  });

  it("laisse vide un compte sans poste métier", () => {
    expect(selectableJobKey(user("Admin", "Super", "ROLE_ADMIN"))).toBe("");
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
      user("Bernard", "Claire", "ROLE_DIRECTEUR"),
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

describe("countByJob", () => {
  it("compte les employés en poste, poste par poste", () => {
    const counts = countByJob([
      user("Durand", "Sophie", "ROLE_CAISSIER"),
      user("Bernard", "Claire", "ROLE_CAISSIER"),
      user("Martin", "Léa", "ROLE_HOTE"),
      user("Robert", "Nadia", "ROLE_DIRECTEUR"),
    ]);

    expect(counts.CAISSIER).toBe(2);
    expect(counts.HOTE).toBe(1);
    expect(counts.DIRECTEUR).toBe(1);
    expect(counts.LAD).toBe(0);
    expect(counts.SECURITE).toBe(0);
    expect(counts.RAYON).toBe(0);
  });

  it("exclut les licenciés du poste", () => {
    const counts = countByJob([
      user("Durand", "Sophie", "ROLE_CAISSIER"),
      user("Petit", "Marc", "ROLE_CAISSIER", { active: false, dismissedAt: "2026-07-01" }),
    ]);

    expect(counts.CAISSIER).toBe(1);
  });

  it("range les comptes sans poste métier dans « Autres »", () => {
    const counts = countByJob([user("Admin", "Super", "ROLE_ADMIN")]);

    expect(counts.AUTRES).toBe(1);
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

describe("Direction vs Directeur/rice", () => {
  it("traite Direction comme catégorie et Directeur/rice comme métier", () => {
    expect(JOB_CATEGORY_DEFS[0]).toEqual({
      key: "DIRECTION",
      label: "Direction",
      shortLabel: "Direction",
    });
    expect(CATEGORY_DEFS[0].key).toBe("DIRECTION");
    expect(CATEGORY_DEFS[0].label).toBe("Direction");
    expect(CATEGORY_DEFS[0].groups).toEqual([
      {
        key: "DIRECTEUR",
        label: "Directeur/rice",
        shortLabel: "Directeur/rice",
        role: "ROLE_DIRECTEUR",
      },
    ]);
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
    expect(direction?.jobs[0]).toEqual({ value: "DIRECTEUR", label: "Directeur/rice" });
  });
});

describe("catalogue de jobs", () => {
  const extra: Job = {
    id: 9,
    code: "CHEF_DE_CAISSE",
    label: "Chef de caisse",
    category: "ACCUEIL_CAISSE",
    protected: false,
    grantsRole: "ROLE_CAISSIER",
  };

  it("retombe sur les métiers d'origine tant que le catalogue est vide", () => {
    expect(categoryDefsFromJobs([]).map((category) => category.key)).toEqual(
      CATEGORY_DEFS.map((category) => category.key),
    );
    expect(categoryDefsFromJobs([])[0].groups.map((group) => group.key)).toEqual(["DIRECTEUR"]);
  });

  it("range un métier ajouté dans sa catégorie", () => {
    const defs = categoryDefsFromJobs([
      {
        id: 1,
        code: "DIRECTEUR",
        label: "Directeur/rice",
        category: "DIRECTION",
        protected: true,
        grantsRole: "ROLE_DIRECTEUR",
      },
      extra,
    ]);
    const accueil = defs.find((category) => category.key === "ACCUEIL_CAISSE");
    expect(accueil?.groups.map((group) => group.key)).toEqual(["CHEF_DE_CAISSE"]);
    expect(defs.map((category) => category.key)).toEqual([
      "DIRECTION",
      "ACCUEIL_CAISSE",
      "SECURITE",
      "RAYON",
      "AUTRES",
    ]);
    expect(recruitmentCategoriesFromJobs([extra])[0].jobs[0]).toEqual({
      value: "CHEF_DE_CAISSE",
      label: "Chef de caisse",
    });
    expect(recruitmentCategoriesFromJobs([extra]).some((category) => category.key === "AUTRES")).toBe(
      false,
    );
  });

  it("compte un employé sur le métier du catalogue plutôt que sur le rôle d'accès", () => {
    const chef = user("Martin", "Paul", "ROLE_CAISSIER", { job: extra });
    expect(groupKeyOf(chef)).toBe("CHEF_DE_CAISSE");
    expect(countByJob([chef], [extra]).CHEF_DE_CAISSE).toBe(1);
    expect(jobTitle(chef)).toBe("Chef de caisse");
    expect(selectableJobKey(chef)).toBe("CHEF_DE_CAISSE");
    expect(countByCategory([chef], [extra]).ACCUEIL_CAISSE).toBe(1);
  });
});
