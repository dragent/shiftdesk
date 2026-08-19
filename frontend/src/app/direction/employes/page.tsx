"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Button, Alert, TimeField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AbsenceReason, Site, User, UserRole } from "@/lib/types";

/**
 * Sous-groupes affichés dans chaque catégorie, dans le même ordre que la
 * grille du planning direction pour que la direction retrouve ses repères.
 */
const ROLE_GROUPS: { key: string; label: string; role: UserRole }[] = [
  { key: "DIRECTION", label: "Direction", role: "ROLE_DIRECTION" },
  { key: "CAISSIER", label: "Caissiers", role: "ROLE_CAISSIER" },
  { key: "LAD", label: "LAD", role: "ROLE_LAD" },
  { key: "HOTE", label: "Hôtes / hôtesses d'accueil", role: "ROLE_HOTE" },
  { key: "SECURITE", label: "Sécurité", role: "ROLE_SECURITE" },
  { key: "RAYON", label: "Rayon", role: "ROLE_RAYON" },
];

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

  // Employés répartis par statut d'emploi, puis par rôle (groupes planning).
  // Un compte sans rôle métier connu (ex. administration) reste visible dans
  // « Autres » pour ne jamais disparaître silencieusement de la liste.
  const groupsByStatus = useMemo(() => {
    function buildGroups(subset: User[]) {
      const remaining = new Set(subset.map((u) => u.id));
      const groups = ROLE_GROUPS.map((group) => {
        const members = subset.filter((u) => u.roles?.includes(group.role));
        members.forEach((u) => remaining.delete(u.id));
        return { key: group.key, label: group.label, users: sortByName(members) };
      }).filter((group) => group.users.length > 0);

      const others = subset.filter((u) => remaining.has(u.id));
      if (others.length > 0) {
        groups.push({ key: "AUTRES", label: "Autres", users: sortByName(others) });
      }
      return groups;
    }

    return {
      employed: buildGroups(users.filter((u) => u.active)),
      dismissed: buildGroups(users.filter((u) => !u.active)),
    };
  }, [users]);

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
          <Button variant="success" onClick={() => setRecruitOpen(true)} disabled={loading}>
            Recrutement
          </Button>
        </div>

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
                <p className="text-sm text-slate-500">Aucun employé en poste.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groupsByStatus.employed.map((group) => (
                    <RoleSection key={group.key} label={group.label}>
                      {group.users.map((user) => (
                        <EmployeeRow key={user.id} user={user}>
                          <Button
                            variant="dark"
                            size="sm"
                            disabled={saving}
                            onClick={() => openAbsence(user, "ARRET_TRAVAIL")}
                          >
                            Arrêt de travail
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={saving}
                            onClick={() => openAbsence(user, "CONGE")}
                          >
                            Vacances
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={saving}
                            onClick={() => setDismissTarget(user)}
                          >
                            Licenciement
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
                <p className="text-sm text-slate-500">Aucun employé licencié.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groupsByStatus.dismissed.map((group) => (
                    <RoleSection key={group.key} label={group.label}>
                      {group.users.map((user) => (
                        <EmployeeRow key={user.id} user={user}>
                          <Button
                            variant="success"
                            size="sm"
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
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
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

function EmployeeRow({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-(--cf-radius-sm) border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-semibold text-slate-800">
          {user.lastName} {user.firstName}
        </span>
        <a
          href={`mailto:${user.email}`}
          className="truncate text-sm text-slate-500 hover:text-cf-blue hover:underline"
        >
          {user.email}
        </a>
        {user.phone ? (
          <a
            href={`tel:${user.phone.replace(/\s/g, "")}`}
            className="text-sm text-slate-500 hover:text-cf-blue hover:underline"
          >
            {user.phone}
          </a>
        ) : (
          <span className="text-sm text-slate-400">Téléphone non renseigné</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
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
