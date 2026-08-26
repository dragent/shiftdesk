"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { EmployeeSearch } from "@/components/EmployeeSearch";
import { Card, Button, Alert, TimeField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { usePageQuery } from "@/lib/usePageQuery";
import {
  buildStatusGroups,
  CATEGORY_DEFS,
  CONTRACT_MINUTE_OPTIONS,
  contractMinutesFromParts,
  countByCategory,
  DEFAULT_CONTRACT_HOURS,
  DEFAULT_CONTRACT_MINUTES,
  DEFAULT_RECRUITMENT_ROLE,
  formatDateFR,
  fullName,
  isDepartureScheduled,
  isDevToolsEnabled,
  MAX_CONTRACT_HOURS,
  normalize,
  RECRUITMENT_CATEGORIES,
  todayISO,
  type CategoryKey,
} from "@/lib/employees";
import type { AbsenceReason, Site, User } from "@/lib/types";

const EMPTY_USERS: User[] = [];
const EMPTY_SITES: Site[] = [];

/** Default hours for a sick leave (full store day). */
const DEFAULT_ARRET_START = "07:00";
const DEFAULT_ARRET_END = "20:15";

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
  const { data, loading, error, setError, refetch } = usePageQuery({
    queryKey: queryKeys.employeesPage,
    queryFn: async () => {
      const [users, sites] = await Promise.all([
        api.get<User[]>("/api/users"),
        api.get<Site[]>("/api/sites"),
      ]);
      return { users, sites };
    },
  });
  const users = data?.users ?? EMPTY_USERS;
  const sites = data?.sites ?? EMPTY_SITES;
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // No category selected initially: the whole team is visible, and a click
  // filters on a category (a second click goes back to showing everything).
  // Search by name, however, always covers all employees.
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [search, setSearch] = useState("");

  // Absence being entered (sick leave or leave) for an employee.
  const [absenceTarget, setAbsenceTarget] = useState<{ user: User; reason: AbsenceReason } | null>(
    null,
  );
  const [absenceStartDate, setAbsenceStartDate] = useState("");
  const [absenceEndDate, setAbsenceEndDate] = useState("");
  const [absenceStartTime, setAbsenceStartTime] = useState(DEFAULT_ARRET_START);
  const [absenceEndTime, setAbsenceEndTime] = useState(DEFAULT_ARRET_END);

  // Employee whose dismissal is pending confirmation, and the effective date entered.
  const [dismissTarget, setDismissTarget] = useState<User | null>(null);
  const [dismissDate, setDismissDate] = useState("");

  const [recruitOpen, setRecruitOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(DEFAULT_RECRUITMENT_ROLE);
  const [contractHours, setContractHours] = useState(String(DEFAULT_CONTRACT_HOURS));
  const [contractExtraMinutes, setContractExtraMinutes] = useState(DEFAULT_CONTRACT_MINUTES);
  const [siteId, setSiteId] = useState<number | "">("");
  const effectiveSiteId = siteId === "" ? (sites[0]?.id ?? "") : siteId;

  const searchTerm = normalize(search.trim());
  const searching = searchTerm.length > 0;

  const counts = useMemo(() => countByCategory(users), [users]);

  const groupsByStatus = useMemo(
    () => buildStatusGroups(users, { category: selectedCategory, searchTerm }),
    [users, selectedCategory, searchTerm],
  );

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
          : `Congés enregistrés pour ${user.firstName} ${user.lastName}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer l'absence.");
    } finally {
      setSaving(false);
    }
  }

  function openDismiss(user: User) {
    setError(null);
    setSuccess(null);
    setDismissDate(todayISO());
    setDismissTarget(user);
  }

  async function updateEmployee(user: User, payload: Record<string, unknown>, message: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/api/users/${user.id}`, payload);
      setDismissTarget(null);
      setSuccess(message);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour l'employé.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Dismissal: only the effective date is sent, the server infers whether the
   * employee leaves the position immediately or on the scheduled date.
   */
  function dismiss(user: User, dismissedAt: string) {
    const scheduled = isDepartureScheduled(dismissedAt);
    return updateEmployee(
      user,
      { dismissedAt },
      scheduled
        ? `${user.firstName} ${user.lastName} quittera l'entreprise le ${formatDateFR(dismissedAt)}.`
        : `${user.firstName} ${user.lastName} a été licencié(e) au ${formatDateFR(dismissedAt)}.`,
    );
  }

  /** Cancels a dismissal that has not taken effect yet. */
  function cancelDismissal(user: User) {
    return updateEmployee(
      user,
      { dismissedAt: null },
      `Le départ de ${user.firstName} ${user.lastName} a été annulé.`,
    );
  }

  /** Rehire: the account becomes active again and loses its dismissal date. */
  function rehire(user: User) {
    return updateEmployee(
      user,
      { active: true },
      `${user.firstName} ${user.lastName} est de nouveau en emploi.`,
    );
  }

  /** Dev-only: permanently remove a dismissed cashier from the database. */
  async function deleteDismissedCashier(user: User) {
    if (!isDevToolsEnabled()) return;
    if (!user.roles?.includes("ROLE_CAISSIER") || user.active) return;
    if (
      !window.confirm(
        `Supprimer définitivement ${fullName(user)} ? Cette action est irréversible (outil de développement).`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/api/users/${user.id}`);
      setSuccess(`${user.firstName} ${user.lastName} a été supprimé(e) définitivement.`);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer cet employé.");
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
        role,
        contractMinutes: contractMinutesFromParts(contractHours, contractExtraMinutes),
        siteId: effectiveSiteId || null,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setContractHours(String(DEFAULT_CONTRACT_HOURS));
      setContractExtraMinutes(DEFAULT_CONTRACT_MINUTES);
      setRecruitOpen(false);
      setSuccess(
        `${firstName} ${lastName} a été recruté(e). Un email avec les identifiants a été envoyé.`,
      );
      await refetch();
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
              Coordonnées de l&apos;équipe, déclaration des arrêts de travail et des Congés,
              licenciement et recrutement.
            </p>
          </div>
          <Button
            variant="success"
            className="w-full sm:w-auto"
            aria-label="Recruter un nouvel employé"
            onClick={() => setRecruitOpen(true)}
            disabled={loading}
          >
            Recrutement
          </Button>
        </div>

        {!loading && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <EmployeeSearch
                value={search}
                onChange={setSearch}
                employees={users}
                className="w-full sm:w-72 sm:shrink-0"
              />

              <div
                aria-label="Filtrer par catégorie d'employés"
                className="cf-seg grid grid-cols-2 sm:flex sm:min-w-0 sm:flex-1 sm:flex-wrap sm:justify-center"
              >
                {CATEGORY_DEFS.map((category) => {
                  const count = counts[category.key];
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
                        <EmployeeRow
                          key={user.id}
                          user={user}
                          meta={
                            user.dismissedAt ? (
                              <StatusBadge tone="warning">
                                Départ le {formatDateFR(user.dismissedAt)}
                              </StatusBadge>
                            ) : null
                          }
                        >
                          {/* The same actions are repeated on every row, with a
                              label shortened on mobile: the name of the employee
                              is spelled out for assistive technologies. */}
                          <Button
                            variant="dark"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={saving}
                            aria-label={`Déclarer un arrêt de travail pour ${fullName(user)}`}
                            onClick={() => openAbsence(user, "ARRET_TRAVAIL")}
                          >
                            <ActionLabel short="Arrêt" full="Arrêt de travail" />
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={saving}
                            aria-label={`Déclarer des Congés pour ${fullName(user)}`}
                            onClick={() => openAbsence(user, "CONGE")}
                          >
                            Congés
                          </Button>
                          {/* An already scheduled departure can be cancelled;
                              to move it, cancel it then enter it again. */}
                          {user.dismissedAt ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 sm:flex-none"
                              disabled={saving}
                              aria-label={`Annuler le départ de ${fullName(user)}`}
                              onClick={() => cancelDismissal(user)}
                            >
                              <ActionLabel short="Annuler" full="Annuler le départ" />
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              className="flex-1 sm:flex-none"
                              disabled={saving}
                              aria-label={`Licencier ${fullName(user)}`}
                              onClick={() => openDismiss(user)}
                            >
                              <ActionLabel short="Licencier" full="Licenciement" />
                            </Button>
                          )}
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
                        <EmployeeRow
                          key={user.id}
                          user={user}
                          meta={
                            user.dismissedAt ? (
                              <StatusBadge tone="neutral">
                                Licencié le {formatDateFR(user.dismissedAt)}
                              </StatusBadge>
                            ) : null
                          }
                        >
                          {/* Same label as the page-level recruitment button:
                              only the accessible name tells them apart. */}
                          <Button
                            variant="success"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={saving}
                            aria-label={`Réembaucher ${fullName(user)}`}
                            onClick={() => rehire(user)}
                          >
                            Recrutement
                          </Button>
                          {/* Hard delete is a local-dev convenience for cleaning
                              demo cashiers; never rendered on a production host. */}
                          {isDevToolsEnabled() && user.roles?.includes("ROLE_CAISSIER") && (
                            <Button
                              variant="danger"
                              size="sm"
                              className="flex-1 sm:flex-none"
                              disabled={saving}
                              aria-label={`Supprimer définitivement ${fullName(user)}`}
                              onClick={() => deleteDismissedCashier(user)}
                            >
                              <ActionLabel short="Suppr." full="Supprimer" />
                            </Button>
                          )}
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
              {absenceTarget.reason === "ARRET_TRAVAIL" ? "Arrêt de travail" : "Congés"}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              dismiss(dismissTarget, dismissDate);
            }}
          >
            <h2 id="dismiss-modal-title" className="text-lg font-semibold text-slate-800">
              Confirmer le licenciement
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              À la date choisie, {dismissTarget.firstName} {dismissTarget.lastName} passera dans la
              liste des licenciés et ne pourra plus être planifié(e). Le compte reste réactivable
              via « Recrutement ».
            </p>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Date du licenciement
              <input
                type="date"
                required
                value={dismissDate}
                onChange={(e) => setDismissDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>

            <p className="mt-2 text-xs text-slate-500">
              {isDepartureScheduled(dismissDate)
                ? `${dismissTarget.firstName} reste en poste et planifiable jusqu'au ${formatDateFR(dismissDate)}.`
                : "Le départ prend effet immédiatement."}
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
              <Button type="submit" variant="danger" disabled={saving}>
                {saving ? "Enregistrement…" : "Licencier"}
              </Button>
            </div>
          </form>
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
                  {RECRUITMENT_CATEGORIES.map((category) =>
                    category.jobs.length === 1 ? (
                      <option key={category.key} value={category.jobs[0].value}>
                        {category.jobs[0].label}
                      </option>
                    ) : (
                      <optgroup key={category.key} label={category.label}>
                        {category.jobs.map((job) => (
                          <option key={job.value} value={job.value}>
                            {job.label}
                          </option>
                        ))}
                      </optgroup>
                    ),
                  )}
                </select>
              </label>
              {/* Hours + quarter-hour minutes, capped at 36 h 45. */}
              <div className="sm:col-span-2">
                <span className="block text-sm font-medium text-slate-700">Contrat</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="recruit-contract-hours">
                    Heures par semaine
                  </label>
                  <input
                    id="recruit-contract-hours"
                    type="number"
                    required
                    min={1}
                    max={MAX_CONTRACT_HOURS}
                    step={1}
                    value={contractHours}
                    onChange={(e) => setContractHours(e.target.value)}
                    className="w-20 rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                  />
                  <span className="text-sm text-slate-600" aria-hidden>
                    h
                  </span>
                  <label className="sr-only" htmlFor="recruit-contract-minutes">
                    Minutes
                  </label>
                  <select
                    id="recruit-contract-minutes"
                    value={contractExtraMinutes}
                    onChange={(e) => setContractExtraMinutes(Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
                  >
                    {CONTRACT_MINUTE_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {String(minutes).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-slate-600" aria-hidden>
                    min
                  </span>
                </div>
              </div>
              {/* Single store in most installations: the site selector is only
                  displayed when there really is more than one. */}
              {sites.length > 1 && (
                <label className="block text-sm font-medium text-slate-700">
                  Site
                  <select
                    value={effectiveSiteId}
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

/** Sub-group header, styled like the schedule sections. */
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
 * One row per employee: contact details then actions. On mobile, the contact
 * details stack and the actions occupy a single row, sharing the width, to
 * keep the cards short and readable.
 */
function EmployeeRow({
  user,
  meta,
  children,
}: {
  user: User;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-(--cf-radius-sm) border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
      {/* Mobile: name and phone on the first line, email below.
          From sm upwards, everything goes back to a single line. */}
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
        {meta}
      </div>
      <div className="flex gap-2 sm:shrink-0">{children}</div>
    </div>
  );
}

/** Status pill displayed under the contact details (planned departure, dismissal). */
function StatusBadge({
  tone,
  children,
}: {
  tone: "neutral" | "warning";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`col-span-2 col-start-1 row-start-3 justify-self-start rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

/**
 * Action label shortened on mobile: the three buttons must fit side by side
 * within the width of a phone.
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
