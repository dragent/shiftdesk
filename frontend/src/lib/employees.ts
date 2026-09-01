import type { Job, JobCategoryKey, User, UserRole } from "@/lib/types";

/** Position (sub-group) an employee is attached to in the list. */
export interface RoleGroup {
  key: string;
  label: string;
  /** Compact label, for the search suggestions. */
  shortLabel: string;
  role: UserRole | null;
}

export interface Category {
  key: string;
  label: string;
  shortLabel: string;
  groups: readonly RoleGroup[];
}

/**
 * Selector categories, mirrored from the management schedule: a category
 * gathers one or more positions, displayed separately in the list.
 * « Autres » collects accounts without a business position (e.g. admin)
 * so that no employee disappears from the page.
 */
export const CATEGORY_DEFS = [
  {
    key: "DIRECTION",
    label: "Direction",
    shortLabel: "Direction",
    groups: [
      {
        key: "DIRECTEUR",
        label: "Directeur/rice",
        shortLabel: "Directeur/rice",
        role: "ROLE_DIRECTEUR",
      },
    ],
  },
  {
    key: "ACCUEIL_CAISSE",
    label: "Accueil / Caisse",
    shortLabel: "Accueil",
    groups: [
      { key: "CAISSIER", label: "Caissiers", shortLabel: "Caisse", role: "ROLE_CAISSIER" },
      { key: "LAD", label: "LAD", shortLabel: "LAD", role: "ROLE_LAD" },
      {
        key: "HOTE",
        label: "Hôtes / hôtesses d'accueil",
        shortLabel: "Accueil",
        role: "ROLE_HOTE",
      },
    ],
  },
  {
    key: "SECURITE",
    label: "Sécurité",
    shortLabel: "Sécurité",
    groups: [{ key: "SECURITE", label: "Sécurité", shortLabel: "Sécurité", role: "ROLE_SECURITE" }],
  },
  {
    key: "RAYON",
    label: "Rayon",
    shortLabel: "Rayon",
    groups: [{ key: "RAYON", label: "Rayon", shortLabel: "Rayon", role: "ROLE_RAYON" }],
  },
  {
    key: "AUTRES",
    label: "Autres",
    shortLabel: "Autres",
    groups: [{ key: "AUTRES", label: "Autres", shortLabel: "Autres", role: null }],
  },
] as const satisfies readonly Category[];

export type CategoryKey = (typeof CATEGORY_DEFS)[number]["key"];

export const JOB_CATEGORY_DEFS: { key: JobCategoryKey; label: string; shortLabel: string }[] = [
  { key: "DIRECTION", label: "Direction", shortLabel: "Direction" },
  { key: "ACCUEIL_CAISSE", label: "Accueil / Caisse", shortLabel: "Accueil" },
  { key: "SECURITE", label: "Sécurité", shortLabel: "Sécurité" },
  { key: "RAYON", label: "Rayon", shortLabel: "Rayon" },
];

/**
 * Builds the category / job tree from the API catalogue. Falls back to
 * {@link CATEGORY_DEFS} when the catalogue has not been loaded yet.
 */
export function categoryDefsFromJobs(jobs: readonly Job[]): Category[] {
  if (jobs.length === 0) {
    return CATEGORY_DEFS.map((category) => ({
      ...category,
      groups: [...category.groups],
    }));
  }

  const categories: Category[] = JOB_CATEGORY_DEFS.map((category) => ({
    key: category.key,
    label: category.label,
    shortLabel: category.shortLabel,
    groups: jobs
      .filter((job) => job.category === category.key)
      .map((job) => ({
        key: job.code,
        label: job.label,
        shortLabel: job.label,
        role: (job.grantsRole ?? null) as UserRole | null,
      })),
  }));

  return [
    ...categories,
    {
      key: "AUTRES",
      label: "Autres",
      shortLabel: "Autres",
      groups: [{ key: "AUTRES", label: "Autres", shortLabel: "Autres", role: null }],
    },
  ];
}

export function recruitmentCategoriesFromJobs(jobs: readonly Job[]): {
  key: string;
  label: string;
  jobs: { value: string; label: string }[];
}[] {
  return categoryDefsFromJobs(jobs)
    .filter((category) => category.key !== "AUTRES")
    .map((category) => ({
      key: category.key,
      label: category.label,
      jobs: category.groups
        .filter((group) => group.key !== "AUTRES")
        .map((group) => ({ value: group.key, label: RECRUITMENT_LABELS[group.key] ?? group.label })),
    }))
    .filter((category) => category.jobs.length > 0);
}

export const ROLE_GROUPS: RoleGroup[] = CATEGORY_DEFS.flatMap((category) => [...category.groups]);

/** Job titles offered when recruiting (admin accounts are created on the admin side). */
const RECRUITMENT_LABELS: Record<string, string> = {
  DIRECTEUR: "Directeur/rice",
  CAISSIER: "Caissier(ère)",
  LAD: "LAD",
  HOTE: "Hôte(sse) d'accueil",
  SECURITE: "Sécurité",
  RAYON: "Rayon",
};

/**
 * Recruitment choices, grouped by category. A category holding several jobs
 * becomes an optgroup, so only its jobs can be picked; a category holding a
 * single job is offered as a plain option. Categories without a business role
 * ("Autres") are not recruitable.
 */
export const RECRUITMENT_CATEGORIES = CATEGORY_DEFS.map((category) => ({
  key: category.key,
  label: category.label,
  jobs: category.groups
    .filter((group) => group.role !== null)
    .map((group) => ({ value: group.key, label: RECRUITMENT_LABELS[group.key] ?? group.label })),
})).filter((category) => category.jobs.length > 0);

export const DEFAULT_RECRUITMENT_ROLE = "CAISSIER";

/** Weekly contract offered by default when recruiting (full-time ceiling). */
export const DEFAULT_CONTRACT_HOURS = 36;
export const DEFAULT_CONTRACT_MINUTES = 45;

/**
 * Dev-only UI tools (e.g. hard-delete of a dismissed cashier). Hidden on a
 * real production host; shown on localhost / `next dev`, or when explicitly
 * enabled with `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`.
 */
export function isDevToolsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "1") return true;
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "0") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }
  return false;
}

/** Quarter-hour steps offered next to the hours field. */
export const CONTRACT_MINUTE_OPTIONS = [0, 15, 30, 45] as const;

/** Legal weekly ceiling used by the store: 36 h 45. */
export const MAX_CONTRACT_HOURS = 36;
export const MAX_CONTRACT_EXTRA_MINUTES = 45;
export const MAX_CONTRACT_MINUTES = MAX_CONTRACT_HOURS * 60 + MAX_CONTRACT_EXTRA_MINUTES;

/**
 * Builds the weekly contract in minutes from hours + a quarter-hour step.
 * Values above 36 h 45 are capped; empty or invalid input falls back to zero
 * (the schedule then treats the contract as unset).
 */
export function contractMinutesFromParts(
  hours: string | number,
  minutes: string | number = 0,
): number {
  const h = Math.trunc(Number(hours));
  const m = Math.trunc(Number(minutes));
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
    return 0;
  }

  const total = h * 60 + m;
  if (total <= 0) return 0;
  return Math.min(total, MAX_CONTRACT_MINUTES);
}

/** Reverse of {@link contractMinutesFromParts}: 2205 → 36 h + 45 min. */
export function contractPartsFromMinutes(total: number): {
  hours: number;
  extraMinutes: (typeof CONTRACT_MINUTE_OPTIONS)[number];
} {
  const capped = Math.max(0, Math.min(Math.trunc(total) || 0, MAX_CONTRACT_MINUTES));
  const hours = Math.floor(capped / 60);
  const remainder = capped % 60;
  const extraMinutes = CONTRACT_MINUTE_OPTIONS.reduce(
    (best, option) =>
      Math.abs(option - remainder) < Math.abs(best - remainder) ? option : best,
    0 as (typeof CONTRACT_MINUTE_OPTIONS)[number],
  );

  return { hours, extraMinutes };
}

export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `2026-08-20` → `20/08/2026`, without going through Date (hence no time zone shift). */
export function formatDateFR(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : iso;
}

/** A departure dated after today leaves the employee in post until then. */
export function isDepartureScheduled(dismissedAt: string, today: string = todayISO()): boolean {
  return dismissedAt > today;
}

/**
 * True when this employee must not receive new schedule hours on `dayKey`
 * (`YYYY-MM-DD`): inactive account, or work day on/after the dismissal date.
 */
export function isUnschedulableOnDate(user: Pick<User, "active" | "dismissedAt">, dayKey: string): boolean {
  if (!user.active) return true;
  if (!user.dismissedAt) return false;
  return dayKey >= user.dismissedAt.slice(0, 10);
}

export function sortByName(users: User[]): User[] {
  return [...users].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"),
  );
}

export function fullName(user: User): string {
  return `${user.lastName} ${user.firstName}`;
}

/** Initials shown in the header avatar and on the profile page. */
export function userInitials(user: Pick<User, "firstName" | "lastName">): string {
  const a = (user.firstName ?? "").trim().charAt(0);
  const b = (user.lastName ?? "").trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/**
 * Job title on the profile page (singular), as opposed to {@link positionLabel}
 * which is the compact team label used in lists.
 */
export function jobTitle(user: User): string {
  if (user.job?.label) {
    return user.job.label;
  }
  const key = groupKeyOf(user);
  if (key === "AUTRES" && user.roles?.includes("ROLE_ADMIN")) {
    return "Administrateur";
  }
  return RECRUITMENT_LABELS[key] ?? "Autre";
}

/** Own profile, or any profile when the viewer is management/admin. */
export function canViewUserProfile(
  viewer: Pick<User, "id" | "roles">,
  targetId: number,
): boolean {
  if (viewer.id === targetId) return true;
  return canEditJobAndContract(viewer);
}

/** Management may change anyone's job and weekly contract from the profile. */
export function canEditJobAndContract(viewer: Pick<User, "roles">): boolean {
  return Boolean(
    viewer.roles?.includes("ROLE_DIRECTEUR") ||
      viewer.roles?.includes("ROLE_DIRECTION") ||
      viewer.roles?.includes("ROLE_ADMIN"),
  );
}

/**
 * Job that can never be taken away once granted, mirroring
 * `UserRole::isProtected()` on the API side.
 */
export const PROTECTED_JOB_ROLE: UserRole = "ROLE_DIRECTEUR";

export function hasProtectedJob(user: Pick<User, "roles">): boolean {
  return Boolean(user.roles?.includes(PROTECTED_JOB_ROLE));
}

/** Recruitment job key, or empty when the account has no business position. */
export function selectableJobKey(user: User): string {
  if (user.job?.code) {
    return user.job.code;
  }
  const key = groupKeyOf(user);
  return RECRUITMENT_CATEGORIES.some((category) =>
    category.jobs.some((job) => job.value === key),
  )
    ? key
    : "";
}

/** Position of an employee: catalogue job, then first known role, « Autres » as a fallback. */
export function groupKeyOf(user: User): string {
  if (user.job?.code) {
    return user.job.code;
  }
  return ROLE_GROUPS.find((group) => group.role && user.roles?.includes(group.role))?.key ?? "AUTRES";
}

/** Case- and accent-insensitive search by name. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** `term` must already be normalized; both first/last name orders are accepted. */
export function matchesName(user: User, term: string): boolean {
  if (!term) return true;
  return (
    normalize(`${user.firstName} ${user.lastName}`).includes(term) ||
    normalize(fullName(user)).includes(term)
  );
}

/** Position displayed second in the search suggestions. */
export function positionLabel(user: User): string {
  const groupKey = groupKeyOf(user);
  return ROLE_GROUPS.find((group) => group.key === groupKey)?.shortLabel ?? "Autres";
}

/** Headcount shown on each button of the category selector. */
export function countByCategory(users: User[], jobs: readonly Job[] = []): Record<CategoryKey, number> {
  const defs = jobs.length > 0 ? categoryDefsFromJobs(jobs) : CATEGORY_DEFS;
  const counts = Object.fromEntries(defs.map((c) => [c.key, 0])) as Record<CategoryKey, number>;
  for (const user of users) {
    const groupKey = groupKeyOf(user);
    const category = defs.find((c) => c.groups.some((g) => g.key === groupKey));
    if (category) counts[category.key as CategoryKey] += 1;
  }
  return counts;
}

/**
 * Headcount per position, keyed like {@link groupKeyOf}. Dismissed accounts are
 * left out: only employees still in post are counted.
 */
export function countByJob(users: User[], jobs: readonly Job[] = []): Record<string, number> {
  const keys = jobs.length > 0 ? jobs.map((job) => job.code) : ROLE_GROUPS.map((group) => group.key);
  const counts: Record<string, number> = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const user of users) {
    if (!user.active) continue;
    const key = groupKeyOf(user);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** A position section of the list, empty sections being dropped upstream. */
export interface EmployeeGroup {
  key: string;
  label: string;
  users: User[];
}

/**
 * Employees split by employment status, then by position. A search by name
 * covers all positions: it takes precedence over the selected category,
 * otherwise the employee being looked up would stay invisible.
 *
 * `searchTerm` must already be normalized via {@link normalize}.
 */
export function buildStatusGroups(
  users: User[],
  {
    category,
    searchTerm,
    jobs = [],
  }: { category: CategoryKey | null; searchTerm: string; jobs?: readonly Job[] },
): { employed: EmployeeGroup[]; dismissed: EmployeeGroup[] } {
  const searching = searchTerm.length > 0;
  const defs = jobs.length > 0 ? categoryDefsFromJobs(jobs) : CATEGORY_DEFS;
  const allGroups = defs.flatMap((c) => [...c.groups]);
  const visibleGroups =
    searching || !category ? allGroups : defs.find((c) => c.key === category)?.groups ?? [];

  function buildGroups(subset: User[]): EmployeeGroup[] {
    const matching = searching ? subset.filter((u) => matchesName(u, searchTerm)) : subset;
    return visibleGroups
      .map((group) => ({
        key: group.key,
        label: group.label,
        users: sortByName(matching.filter((u) => groupKeyOf(u) === group.key)),
      }))
      .filter((group) => group.users.length > 0);
  }

  return {
    employed: buildGroups(users.filter((u) => u.active)),
    dismissed: buildGroups(users.filter((u) => !u.active)),
  };
}
