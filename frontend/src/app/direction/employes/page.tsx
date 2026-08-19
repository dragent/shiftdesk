"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Button, Alert, TimeField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AbsenceReason, Site, User, UserRole } from "@/lib/types";

/**
 * Catégories du sélecteur, reprises du planning direction : une catégorie
 * regroupe un ou plusieurs postes, affichés séparément dans la liste.
 * « Autres » recueille les comptes sans poste métier (ex. administration)
 * pour qu'aucun employé ne disparaisse de la page.
 */
const CATEGORY_DEFS = [
  {
    key: "DIRECTION",
    label: "Direction",
    shortLabel: "Direction",
    groups: [{ key: "DIRECTION", label: "Direction", role: "ROLE_DIRECTION" }],
  },
  {
    key: "ACCUEIL_CAISSE",
    label: "Accueil / Caisse",
    shortLabel: "Accueil",
    groups: [
      { key: "CAISSIER", label: "Caissiers", role: "ROLE_CAISSIER" },
      { key: "LAD", label: "LAD", role: "ROLE_LAD" },
      { key: "HOTE", label: "Hôtes / hôtesses d'accueil", role: "ROLE_HOTE" },
    ],
  },
  {
    key: "SECURITE",
    label: "Sécurité",
    shortLabel: "Sécurité",
    groups: [{ key: "SECURITE", label: "Sécurité", role: "ROLE_SECURITE" }],
  },
  {
    key: "RAYON",
    label: "Rayon",
    shortLabel: "Rayon",
    groups: [{ key: "RAYON", label: "Rayon", role: "ROLE_RAYON" }],
  },
  {
    key: "AUTRES",
    label: "Autres",
    shortLabel: "Autres",
    groups: [{ key: "AUTRES", label: "Autres", role: null }],
  },
] as const satisfies readonly Category[];

/** Poste (sous-groupe) auquel un employé est rattaché dans la liste. */
interface RoleGroup {
  key: string;
  label: string;
  role: UserRole | null;
}

interface Category {
  key: string;
  label: string;
  shortLabel: string;
  groups: readonly RoleGroup[];
}

type CategoryKey = (typeof CATEGORY_DEFS)[number]["key"];

const ROLE_GROUPS: RoleGroup[] = CATEGORY_DEFS.flatMap((category) => [...category.groups]);

/** Rôles proposés au recrutement (l'administration se crée côté admin). */
const RECRUITMENT_ROLES = [
  { value: "CAISSIER", label: "Caissier(ère)" },
  { value: "HOTE", label: "Hôte(sse) d'accueil" },
  { value: "LAD", label: "LAD" },
  { value: "RAYON", label: "Rayon" },
  { value: "SECURITE", label: "Sécurité" },
  { value: "DIRECTION", label: "Direction" },
];

/** Horaires par défaut d'un arrêt de travail (journée complète magasin). */
const DEFAULT_ARRET_START = "07:00";
const DEFAULT_ARRET_END = "20:15";

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function sortByName(users: User[]): User[] {
  return [...users].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"),
  );
}

function fullName(user: User): string {
  return `${user.lastName} ${user.firstName}`;
}

/** Poste d'un employé : premier rôle connu, « Autres » à défaut. */
function groupKeyOf(user: User): string {
  return ROLE_GROUPS.find((group) => group.role && user.roles?.includes(group.role))?.key ?? "AUTRES";
}

/** Recherche par nom insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function EmployesPage() {
  return (
    <RoleGuard roles={["ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <EmployesContent />
      </AppShell>
    </RoleGuard>
  );
}

function EmployesContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Aucune catégorie sélectionnée au départ : toute l'équipe est visible, et
  // un clic filtre sur une catégorie (un second clic revient à tout voir).
  // La recherche par nom, elle, porte toujours sur l'ensemble des employés.
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [search, setSearch] = useState("");

  // Absence en cours de saisie (arrêt de travail ou vacances) pour un employé.
  const [absenceTarget, setAbsenceTarget] = useState<{ user: User; reason: AbsenceReason } | null>(
    null,
  );
  const [absenceStartDate, setAbsenceStartDate] = useState("");
  const [absenceEndDate, setAbsenceEndDate] = useState("");
  const [absenceStartTime, setAbsenceStartTime] = useState(DEFAULT_ARRET_START);
  const [absenceEndTime, setAbsenceEndTime] = useState(DEFAULT_ARRET_END);

  // Employé dont le licenciement est à confirmer.
  const [dismissTarget, setDismissTarget] = useState<User | null>(null);

  const [recruitOpen, setRecruitOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(RECRUITMENT_ROLES[0].value);
  const [siteId, setSiteId] = useState<number | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, sitesData] = await Promise.all([
        api.get<User[]>("/api/users"),
        api.get<Site[]>("/api/sites"),
      ]);
      setUsers(usersData);
      setSites(sitesData);
      setSiteId((current) => (current === "" && sitesData.length > 0 ? sitesData[0].id : current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const searchTerm = normalize(search.trim());
  const searching = searchTerm.length > 0;

  const countByCategory = useMemo(() => {
    const counts = Object.fromEntries(CATEGORY_DEFS.map((c) => [c.key, 0])) as Record<
      CategoryKey,
      number
    >;
    for (const user of users) {
      const groupKey = groupKeyOf(user);
      const category = CATEGORY_DEFS.find((c) => c.groups.some((g) => g.key === groupKey));
      if (category) counts[category.key] += 1;
    }
    return counts;
  }, [users]);

  /** Noms proposés en auto-complétion dans le champ de recherche. */
  const employeeNames = useMemo(() => sortByName(users).map(fullName), [users]);

  // Employés répartis par statut d'emploi, puis par poste. Une recherche par
  // nom porte sur tous les postes : elle prend le pas sur la catégorie
  // sélectionnée, sinon l'employé cherché resterait invisible.
  const groupsByStatus = useMemo(() => {
    const visibleGroups =
      searching || !selectedCategory
        ? ROLE_GROUPS
        : CATEGORY_DEFS.find((c) => c.key === selectedCategory)?.groups ?? [];

    function matchesSearch(user: User): boolean {
      return (
        normalize(`${user.firstName} ${user.lastName}`).includes(searchTerm) ||
        normalize(fullName(user)).includes(searchTerm)
      );
    }

    function buildGroups(subset: User[]) {
      const matching = searching ? subset.filter(matchesSearch) : subset;
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
  }, [users, selectedCategory, searching, searchTerm]);

  function openAbsence(user: User, reason: AbsenceReason) {
    setError(null);
    setSuccess(null);
    const today = todayISO();
    setAbsenceStartDate(today);
    setAbsenceEndDate(today);
    setAbsenceStartTime(DEFAULT_ARRET_START);
    setAbsenceEndTime(DEFAULT_ARRET_END);
    setAbsenceTarget({ user, reason });
  }

  async function submitAbsence(e: FormEvent) {
    e.preventDefault();
    if (!absenceTarget) return;
    const { user, reason } = absenceTarget;

    setSaving(true);
    setError(null);
    try {
      await api.post("/api/absences", {
        userId: user.id,
        reason,
        startDate: absenceStartDate,
        endDate: absenceEndDate,
        ...(reason === "ARRET_TRAVAIL"
          ? { startTime: absenceStartTime, endTime: absenceEndTime }
          : {}),
      });
      setAbsenceTarget(null);
      setSuccess(
        reason === "ARRET_TRAVAIL"
          ? `Arrêt de travail enregistré pour ${user.firstName} ${user.lastName}.`
          : `Vacances enregistrées pour ${user.firstName} ${user.lastName}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer l'absence.");
    } finally {
      setSaving(false);
    }
  }

  /** Licenciement / réembauche : bascule le statut d'emploi du compte. */
  async function setEmployed(user: User, employed: boolean) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/api/users/${user.id}`, { active: employed });
      setDismissTarget(null);
      setSuccess(
        employed
          ? `${user.firstName} ${user.lastName} est de nouveau en emploi.`
          : `${user.firstName} ${user.lastName} a été licencié(e).`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour l'employé.");
    } finally {
      setSaving(false);
    }
  }

  async function submitRecruitment(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post<User>("/api/users", {
        firstName,
        lastName,
        email,
        phone: phone || null,
        password,
        role,
        siteId: siteId || null,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRecruitOpen(false);
      setSuccess(`${firstName} ${lastName} a été recruté(e).`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de recruter cet employé.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-800">Employés</h1>
            <p className="mt-1 text-sm text-slate-500">
              Coordonnées de l&apos;équipe, déclaration des arrêts de travail et des vacances,
              licenciement et recrutement.
            </p>
          </div>
          <Button
            variant="success"
            className="w-full sm:w-auto"
            onClick={() => setRecruitOpen(true)}
            disabled={loading}
          >
            Recrutement
          </Button>
        </div>

        {!loading && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                list="employes-noms"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un employé…"
                aria-label="Rechercher un employé par nom"
                className="w-full rounded-(--cf-radius-sm) border border-slate-300 bg-white px-3 py-2.5 text-sm sm:w-64 sm:shrink-0"
              />
              <datalist id="employes-noms">
                {employeeNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <div
                aria-label="Filtrer par catégorie d'employés"
                className="cf-seg grid grid-cols-2 sm:flex sm:min-w-0 sm:flex-1 sm:flex-wrap sm:justify-center"
              >
                {CATEGORY_DEFS.map((category) => {
                  const count = countByCategory[category.key];
                  const active = !searching && selectedCategory === category.key;
                  return (
                    <button
                      key={category.key}
                      type="button"
                      disabled={count === 0 || searching}
                      onClick={() =>
                        setSelectedCategory((current) =>
                          current === category.key ? null : category.key,
                        )
                      }
                      aria-pressed={active}
                      title={
                        active
                          ? `${category.label} — cliquer pour afficher toutes les catégories`
                          : category.label
                      }
                      className={`cf-seg__btn justify-between sm:justify-center ${
                        active ? "cf-seg__btn--active" : ""
                      }`}
                    >
                      <span className="truncate">
                        <span className="sm:hidden">{category.shortLabel}</span>
                        <span className="hidden sm:inline">{category.label}</span>
                      </span>
                      <span className="cf-seg__count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {searching && (
              <p className="text-xs text-slate-500">
                Recherche sur toutes les catégories.{" "}
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="font-semibold text-cf-blue underline"
                >
                  Effacer
                </button>
              </p>
            )}
          </div>
        )}

        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {loading ? (
          <Card>
            <p className="text-sm text-slate-400">Chargement...</p>
          </Card>
        ) : (
          <>
            <Card title="En emploi">
              {groupsByStatus.employed.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {searching
                    ? "Aucun employé en poste ne correspond à cette recherche."
                    : selectedCategory
                      ? "Aucun employé en poste dans cette catégorie."
                      : "Aucun employé en poste."}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groupsByStatus.employed.map((group) => (
                    <RoleSection key={group.key} label={group.label}>
                      {group.users.map((user) => (
                        <EmployeeRow key={user.id} user={user}>
                          <Button
                            variant="dark"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={saving}
                            onClick={() => openAbsence(user, "ARRET_TRAVAIL")}
                          >
                            <ActionLabel short="Arrêt" full="Arrêt de travail" />
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={saving}
                            onClick={() => openAbsence(user, "CONGE")}
                          >
                            Vacances
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={saving}
                            onClick={() => setDismissTarget(user)}
                          >
                            <ActionLabel short="Licencier" full="Licenciement" />
                          </Button>
                        </EmployeeRow>
                      ))}
                    </RoleSection>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Licenciés">
              {groupsByStatus.dismissed.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {searching
                    ? "Aucun employé licencié ne correspond à cette recherche."
                    : selectedCategory
                      ? "Aucun employé licencié dans cette catégorie."
                      : "Aucun employé licencié."}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groupsByStatus.dismissed.map((group) => (
                    <RoleSection key={group.key} label={group.label}>
                      {group.users.map((user) => (
                        <EmployeeRow key={user.id} user={user}>
                          <Button
                            variant="success"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={saving}
                            onClick={() => setEmployed(user, true)}
                          >
                            Recrutement
                          </Button>
                        </EmployeeRow>
                      ))}
                    </RoleSection>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {absenceTarget && (
        <ModalShell
          titleId="absence-modal-title"
          onClose={() => !saving && setAbsenceTarget(null)}
        >
          <form onSubmit={submitAbsence}>
            <h2 id="absence-modal-title" className="text-lg font-semibold text-slate-800">
              {absenceTarget.reason === "ARRET_TRAVAIL" ? "Arrêt de travail" : "Vacances"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {absenceTarget.user.firstName} {absenceTarget.user.lastName} — les demi-journées
              concernées seront bloquées dans le planning.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <label className="block text-sm font-medium text-slate-700">
                Date de début
                <input
                  type="date"
                  required
                  value={absenceStartDate}
                  onChange={(e) => setAbsenceStartDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Date de fin
                <input
                  type="date"
                  required
                  min={absenceStartDate || undefined}
                  value={absenceEndDate}
                  onChange={(e) => setAbsenceEndDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>

              {absenceTarget.reason === "ARRET_TRAVAIL" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Heure de début
                    <TimeField
                      required
                      value={absenceStartTime}
                      onChange={setAbsenceStartTime}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Heure de fin
                    <TimeField
                      required
                      value={absenceEndTime}
                      onChange={setAbsenceEndTime}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setAbsenceTarget(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : "Valider"}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

      {dismissTarget && (
        <ModalShell titleId="dismiss-modal-title" onClose={() => !saving && setDismissTarget(null)}>
          <h2 id="dismiss-modal-title" className="text-lg font-semibold text-slate-800">
            Confirmer le licenciement
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {dismissTarget.firstName} {dismissTarget.lastName} passera dans la liste des licenciés et
            ne pourra plus être planifié(e). Le compte reste réactivable via « Recrutement ».
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setDismissTarget(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={saving}
              onClick={() => setEmployed(dismissTarget, false)}
            >
              {saving ? "Enregistrement…" : "Licencier"}
            </Button>
          </div>
        </ModalShell>
      )}

      {recruitOpen && (
        <ModalShell titleId="recruit-modal-title" onClose={() => !saving && setRecruitOpen(false)}>
          <form onSubmit={submitRecruitment}>
            <h2 id="recruit-modal-title" className="text-lg font-semibold text-slate-800">
              Recrutement
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Crée le compte du nouvel employé et l&apos;ajoute au planning de son équipe.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Prénom
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Nom
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Téléphone
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Poste
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
                >
                  {RECRUITMENT_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {/* Magasin unique dans la plupart des installations : on n'affiche
                  le choix du site que s'il y en a réellement plusieurs. */}
              {sites.length > 1 && (
                <label className="block text-sm font-medium text-slate-700">
                  Site
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-medium text-slate-700">
                Mot de passe provisoire
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setRecruitOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" variant="success" disabled={saving}>
                {saving ? "Enregistrement…" : "Recruter"}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}

/** En-tête de sous-groupe, dans le style des sections du planning. */
function RoleSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 border-b-2 border-slate-300 pb-1.5 text-sm font-semibold uppercase tracking-wide text-slate-700">
        {label}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/**
 * Une ligne par employé : coordonnées puis actions. Sur mobile, les
 * coordonnées s'empilent et les actions occupent une seule rangée en se
 * partageant la largeur, pour garder des cartes courtes et lisibles.
 */
function EmployeeRow({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-(--cf-radius-sm) border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
      {/* Mobile : nom et téléphone sur la première ligne, mail en dessous.
          À partir de sm, tout revient sur une seule ligne. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 sm:flex sm:flex-wrap">
        <p className="col-start-1 row-start-1 truncate font-semibold text-slate-800">
          {user.lastName} {user.firstName}
        </p>
        <a
          href={`mailto:${user.email}`}
          className="col-span-2 col-start-1 row-start-2 truncate text-sm text-slate-500 hover:text-cf-blue hover:underline"
        >
          {user.email}
        </a>
        {user.phone ? (
          <a
            href={`tel:${user.phone.replace(/\s/g, "")}`}
            className="col-start-2 row-start-1 shrink-0 text-sm text-slate-500 hover:text-cf-blue hover:underline"
          >
            {user.phone}
          </a>
        ) : (
          <span className="col-start-2 row-start-1 shrink-0 text-sm text-slate-400">
            Téléphone non renseigné
          </span>
        )}
      </div>
      <div className="flex gap-2 sm:shrink-0">{children}</div>
    </div>
  );
}

/**
 * Libellé d'action raccourci sur mobile : les trois boutons doivent tenir
 * côte à côte sur la largeur d'un téléphone.
 */
function ActionLabel({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}

function ModalShell({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
