"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Button, Alert, TimeField, WeekNavigator } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import {
  addHours,
  DAY_LABELS,
  defaultEndForSlot,
  durationMinutes,
  formatFrenchTime,
  formatMinutesAsHours,
  earliestStartForUser,
  HALF_DAY_SLOTS,
  isPlanningSlotClosed,
  latestEndForDay,
  slotKeyForTime,
  type HalfDayKey,
} from "@/lib/planning";
import type { Absence, Planning, StoreClosure, User } from "@/lib/types";

const HALF_DAY_OPTIONS: { value: HalfDayKey; label: string }[] = [
  { value: "MATIN", label: "Matin" },
  { value: "APRES_MIDI", label: "Après-midi" },
];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Pause déjeuner minimale exigée entre un créneau du matin et de l'après-midi. */
const MIN_LUNCH_BREAK_MINUTES = 60;

/**
 * Catégories filtrables dans la grille. Une catégorie peut regrouper plusieurs
 * sous-groupes (rôles) affichés séparément dans le planning.
 */
const CATEGORY_DEFS = [
  {
    key: "DIRECTION",
    label: "Direction",
    shortLabel: "Direction",
    groups: [{ key: "DIRECTION", label: "Direction" }],
  },
  {
    key: "ACCUEIL_CAISSE",
    label: "Accueil / Caisse",
    shortLabel: "Accueil",
    groups: [
      { key: "CAISSIER", label: "Caissiers" },
      { key: "LAD", label: "LAD" },
      { key: "HOTE", label: "Hôtes / hôtesses d'accueil" },
    ],
  },
  {
    key: "SECURITE",
    label: "Sécurité",
    shortLabel: "Sécurité",
    groups: [{ key: "SECURITE", label: "Sécurité" }],
  },
  {
    key: "RAYON",
    label: "Rayon",
    shortLabel: "Rayon",
    groups: [{ key: "RAYON", label: "Rayon" }],
  },
] as const;
type CategoryKey = (typeof CATEGORY_DEFS)[number]["key"];
type RoleGroupKey = (typeof CATEGORY_DEFS)[number]["groups"][number]["key"];

function toISODate(date: Date): string {
  // Formatage en heure locale (et non toISOString(), qui convertit en UTC
  // et décalerait la date d'un jour selon le fuseau horaire).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PlanningPage() {
  return (
    <RoleGuard roles={["ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <PlanningContent />
      </AppShell>
    </RoleGuard>
  );
}

function PlanningContent() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [closures, setClosures] = useState<StoreClosure[]>([]);
  const [caissiers, setCaissiers] = useState<User[]>([]);
  const [lad, setLad] = useState<User[]>([]);
  const [hotes, setHotes] = useState<User[]>([]);
  const [directionStaff, setDirectionStaff] = useState<User[]>([]);
  const [rayon, setRayon] = useState<User[]>([]);
  const [securite, setSecurite] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Catégorie d'employés actuellement affichée dans la grille (une seule à
  // la fois) ; la direction est affichée par défaut.
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(CATEGORY_DEFS[0].key);

  // Case en cours d'édition (ajout d'un horaire) : la direction choisit
  // elle-même l'heure de début/fin, pré-remplies avec la plage par défaut
  // de la demi-journée (matin/après-midi) mais librement modifiables.
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formEnCaisse, setFormEnCaisse] = useState(false);

  // Portée de l'impression : "ALL" pour tout le planning affiché (avec
  // feuille d'émargement ajoutée sous chaque ligne), ou l'identifiant d'un
  // employé pour n'imprimer que son planning personnel.
  const [printScope, setPrintScope] = useState<string>("ALL");

  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");
  const [closureHalfDay, setClosureHalfDay] = useState<HalfDayKey>("MATIN");
  const [closureSaving, setClosureSaving] = useState(false);
  const planningScrollRef = useRef<HTMLDivElement>(null);

  const scrollPlanning = (direction: "left" | "right") => {
    const el = planningScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = toISODate(weekStart);
      const to = toISODate(weekDays[6]);
      const [planningData, absencesData, closuresData, usersData] = await Promise.all([
        api.get<Planning[]>(`/api/plannings?from=${from}&to=${to}`),
        api.get<Absence[]>(`/api/absences?from=${from}&to=${to}`),
        api.get<StoreClosure[]>(`/api/store-closures?from=${from}&to=${to}`),
        api.get<User[]>("/api/users"),
      ]);
      setPlannings(planningData);
      setAbsences(absencesData);
      setClosures(closuresData);
      setCaissiers(usersData.filter((u) => u.roles?.includes("ROLE_CAISSIER")));
      setLad(usersData.filter((u) => u.roles?.includes("ROLE_LAD")));
      setHotes(usersData.filter((u) => u.roles?.includes("ROLE_HOTE")));
      setDirectionStaff(usersData.filter((u) => u.roles?.includes("ROLE_DIRECTION")));
      setRayon(usersData.filter((u) => u.roles?.includes("ROLE_RAYON")));
      setSecurite(usersData.filter((u) => u.roles?.includes("ROLE_SECURITE")));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  // Regroupe les créneaux par employé + jour + demi-journée pour un accès
  // rapide en O(1) depuis la grille.
  const planningByCell = useMemo(() => {
    const map = new Map<string, Planning>();
    for (const p of plannings) {
      const key = `${p.user.id}_${p.workDate}_${slotKeyForTime(p.startTime)}`;
      map.set(key, p);
    }
    return map;
  }, [plannings]);

  // Absence couvrant un employé un jour donné (clé `${userId}_${dayKey}`).
  const absenceByUserDay = useMemo(() => {
    const map = new Map<string, Absence>();
    for (const absence of absences) {
      const start = new Date(`${absence.startDate}T00:00:00`);
      const end = new Date(`${absence.endDate}T00:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        map.set(`${absence.user.id}_${toISODate(d)}`, absence);
      }
    }
    return map;
  }, [absences]);

  // Total d'heures planifiées (hors jours d'absence), pour la colonne Total.
  const totalMinutesByUser = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of plannings) {
      if (absenceByUserDay.has(`${p.user.id}_${p.workDate}`)) continue;
      const mins = durationMinutes(p.startTime, p.endTime);
      map.set(p.user.id, (map.get(p.user.id) ?? 0) + mins);
    }
    return map;
  }, [plannings, absenceByUserDay]);

  function startAdd(user: User, dayKey: string, slotKey: HalfDayKey, dayIndex: number) {
    if (absenceByUserDay.has(`${user.id}_${dayKey}`)) return;
    const cellKey = `${user.id}_${dayKey}_${slotKey}`;
    // Accueil 7h / caissiers 7h30 en semaine ; dimanche 7h30 / 8h.
    // Direction / Rayon : matin dès 04h00.
    let defaultStart = earliestStartForUser(user, slotKey, dayIndex);
    const defaultEnd = defaultEndForSlot(slotKey, dayIndex);

    // Si la personne travaille déjà le matin ce jour-là, l'après-midi
    // commence une heure après la fin du matin (pause déjeuner).
    if (slotKey === "APRES_MIDI") {
      const morningEntry = planningByCell.get(`${user.id}_${dayKey}_MATIN`);
      if (morningEntry) {
        defaultStart = addHours(morningEntry.endTime, 1);
      }
    }

    setEditingCell(cellKey);
    setFormStart(defaultStart);
    setFormEnd(defaultEnd);
    setFormEnCaisse(false);
  }

  function cancelAdd() {
    setEditingCell(null);
    setFormEnCaisse(false);
  }

  async function submitAdd(e: FormEvent, user: User, dayKey: string, cellKey: string, slotKey: HalfDayKey) {
    e.preventDefault();
    setError(null);

    // La pause déjeuner entre le matin et l'après-midi doit être d'au moins
    // 1h : on bloque la sauvegarde avant même d'appeler l'API si la coupure
    // avec l'autre demi-journée (déjà planifiée ce jour-là) est trop courte.
    const otherSlotKey: HalfDayKey = slotKey === "MATIN" ? "APRES_MIDI" : "MATIN";
    const otherEntry = planningByCell.get(`${user.id}_${dayKey}_${otherSlotKey}`);
    if (otherEntry) {
      const breakMinutes =
        slotKey === "MATIN"
          ? durationMinutes(formEnd, otherEntry.startTime)
          : durationMinutes(otherEntry.endTime, formStart);
      if (breakMinutes < MIN_LUNCH_BREAK_MINUTES) {
        setError(
          `La coupure entre le matin et l'après-midi doit être d'au moins 1h (pause déjeuner) : actuellement ${formatMinutesAsHours(breakMinutes)}.`,
        );
        return;
      }
    }

    setPendingKey(cellKey);
    try {
      await api.post<Planning>("/api/plannings", {
        userId: user.id,
        workDate: dayKey,
        startTime: formStart,
        endTime: formEnd,
        ...(canMarkEnCaisse(user) ? { enCaisse: formEnCaisse } : {}),
      });
      setEditingCell(null);
      setFormEnCaisse(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter ce créneau.");
    } finally {
      setPendingKey(null);
    }
  }

  async function removeSlot(planning: Planning, cellKey: string) {
    setError(null);
    setPendingKey(cellKey);
    try {
      await api.delete(`/api/plannings/${planning.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de retirer ce créneau.");
    } finally {
      setPendingKey(null);
    }
  }

  function openClosureModal() {
    setClosureStart(toISODate(weekStart));
    setClosureEnd(toISODate(weekDays[6]));
    setClosureHalfDay("MATIN");
    setClosureModalOpen(true);
  }

  async function submitClosure(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!closureStart || !closureEnd) {
      setError("Date de début et date de fin sont obligatoires.");
      return;
    }
    if (closureEnd < closureStart) {
      setError("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }
    setClosureSaving(true);
    try {
      await api.post<StoreClosure>("/api/store-closures", {
        startDate: closureStart,
        startHalfDay: closureHalfDay,
        endDate: closureEnd,
      });
      setClosureModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer la fermeture.");
    } finally {
      setClosureSaving(false);
    }
  }

  const noEmployees =
    caissiers.length === 0 &&
    lad.length === 0 &&
    hotes.length === 0 &&
    directionStaff.length === 0 &&
    rayon.length === 0 &&
    securite.length === 0;
  const todayISO = toISODate(new Date());

  // Employés par rôle (sous-groupe), réutilisé pour filtres, impression et grille.
  const usersByRoleGroup: Record<RoleGroupKey, User[]> = useMemo(
    () => ({
      CAISSIER: caissiers,
      LAD: lad,
      HOTE: hotes,
      SECURITE: securite,
      RAYON: rayon,
      DIRECTION: directionStaff,
    }),
    [caissiers, lad, hotes, securite, rayon, directionStaff],
  );

  const usersByCategory = useMemo(() => {
    const result = {} as Record<CategoryKey, User[]>;
    for (const cat of CATEGORY_DEFS) {
      result[cat.key] = cat.groups.flatMap((g) => usersByRoleGroup[g.key]);
    }
    return result;
  }, [usersByRoleGroup]);

  // Sous-groupes non vides (pour la sélection d'impression et les sections grille).
  const employeeGroups = useMemo(
    () =>
      CATEGORY_DEFS.flatMap((c) =>
        c.groups.map((g) => ({
          key: g.key,
          label: g.label,
          categoryKey: c.key,
          users: usersByRoleGroup[g.key],
        })),
      ).filter((group) => group.users.length > 0),
    [usersByRoleGroup],
  );

  // Sous-groupes de la catégorie sélectionnée (ex. Caissiers + LAD + Accueil).
  const visibleEmployeeGroups = useMemo(
    () => employeeGroups.filter((group) => group.categoryKey === selectedCategory),
    [employeeGroups, selectedCategory],
  );

  const selectedPrintUser =
    printScope !== "ALL"
      ? employeeGroups.flatMap((g) => g.users).find((u) => String(u.id) === printScope) ?? null
      : null;

  const slotHandlers = {
    pendingKey,
    editingCell,
    formStart,
    formEnd,
    formEnCaisse,
    absenceByUserDay,
    closures,
    onFormStartChange: setFormStart,
    onFormEndChange: setFormEnd,
    onFormEnCaisseChange: setFormEnCaisse,
    onStartAdd: startAdd,
    onCancelAdd: cancelAdd,
    onSubmitAdd: submitAdd,
    onRemove: removeSlot,
  };

  return (
    <>
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6 print:hidden">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-800">Planning</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="sm:hidden">
              Appuyez sur <strong className="font-semibold text-slate-600">+</strong> pour planifier, ou
              sur un créneau pour le retirer. Accueil 7h–20h15, caissiers 7h30–20h15 ; dimanche jusqu&apos;à
              13h15.
            </span>
            <span className="hidden sm:inline">
              Cliquez sur une case <strong className="font-semibold text-slate-600">vide (+)</strong> pour
              planifier un créneau, ou sur un{" "}
              <strong className="font-semibold text-slate-600">créneau existant</strong> pour le retirer.
              En semaine : accueil <strong className="font-semibold text-slate-600">7h00–20h15</strong>,
              caissiers <strong className="font-semibold text-slate-600">7h30–20h15</strong>. Dimanche :
              accueil <strong className="font-semibold text-slate-600">7h30–13h15</strong>, caissiers{" "}
              <strong className="font-semibold text-slate-600">8h00–13h15</strong> (après-midi fermé).
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />

          {/* Catégories */}
          {!loading && !noEmployees && (
            <div
              role="radiogroup"
              aria-label="Catégorie d'employés à afficher"
              className="cf-seg grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center"
            >
              {CATEGORY_DEFS.map((cat) => {
                const count = usersByCategory[cat.key].length;
                const active = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    disabled={count === 0}
                    onClick={() => setSelectedCategory(cat.key)}
                    role="radio"
                    aria-checked={active}
                    title={cat.label}
                    className={`cf-seg__btn justify-between sm:justify-center ${
                      active ? "cf-seg__btn--active" : ""
                    }`}
                  >
                    <span className="truncate">
                      <span className="sm:hidden">{cat.shortLabel}</span>
                      <span className="hidden sm:inline">{cat.label}</span>
                    </span>
                    <span className="cf-seg__count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card
        title={CATEGORY_DEFS.find((c) => c.key === selectedCategory)?.label ?? "Planning"}
        actions={
          <Button type="button" variant="secondary" onClick={openClosureModal} disabled={loading}>
            Fermeture
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : noEmployees ? (
          <p className="text-sm text-slate-500">Aucun caissier ni hôte(sse) enregistré(e).</p>
        ) : visibleEmployeeGroups.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun employé dans cette catégorie.</p>
        ) : (
          <>
            {/* Mobile / tablette : une carte par employé, jours empilés. */}
            <div className="flex flex-col gap-4 lg:hidden">
              {visibleEmployeeGroups.map((group) => (
                <MobileEmployeeGroup
                  key={group.key}
                  label={group.label}
                  users={group.users}
                  weekDays={weekDays}
                  todayISO={todayISO}
                  planningByCell={planningByCell}
                  totalMinutesByUser={totalMinutesByUser}
                  {...slotHandlers}
                />
              ))}
            </div>

            {/* Desktop : une seule table — Total sticky à droite (pas de 2e table = pas de décalage). */}
            <div className="-mx-4 hidden min-w-0 px-4 sm:-mx-5 sm:px-5 lg:block">
              <div className="mb-2 flex items-center justify-end gap-2">
                <span className="mr-auto text-sm text-slate-500">
                  Faites glisser la barre ou utilisez les flèches pour voir toute la semaine
                </span>
                <Button type="button" variant="secondary" onClick={() => scrollPlanning("left")}>
                  ← Jours
                </Button>
                <Button type="button" variant="secondary" onClick={() => scrollPlanning("right")}>
                  Jours →
                </Button>
              </div>
              <div
                ref={planningScrollRef}
                className="planning-scroll min-w-0 rounded-md border border-slate-200"
              >
                <table className="w-max min-w-full border-separate border-spacing-0 text-base">
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        className="planning-col-employee sticky left-0 z-30 min-w-[220px] border-b-2 border-r-2 border-slate-300 bg-slate-50 p-2.5 text-left align-bottom text-base font-semibold text-slate-700"
                      >
                        Employé
                      </th>
                      {weekDays.map((day, idx) => {
                        const isToday = toISODate(day) === todayISO;
                        return (
                          <th
                            key={toISODate(day)}
                            colSpan={HALF_DAY_SLOTS.length}
                            className={`border-b border-r-2 border-slate-300 p-2 text-center font-semibold ${
                              isToday ? "bg-(--cf-blue)/10 text-cf-blue" : "bg-slate-50 text-slate-600"
                            }`}
                          >
                            {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                            {isToday && (
                              <span className="ml-1.5 inline-block rounded-full bg-cf-blue px-2 py-0.5 text-xs font-semibold text-white align-middle">
                                Aujourd&apos;hui
                              </span>
                            )}
                          </th>
                        );
                      })}
                      <th
                        rowSpan={2}
                        className={`${TOTAL_COL_CLASS} planning-col-total-sticky sticky right-0 z-30 border-b-2 bg-slate-50 p-2.5 align-bottom text-sm font-bold uppercase tracking-wide text-slate-600`}
                      >
                        Total
                      </th>
                    </tr>
                    <tr>
                      {weekDays.map((day, idx) => {
                        const isToday = toISODate(day) === todayISO;
                        return HALF_DAY_SLOTS.map((slot, slotIdx) => {
                          const dayKey = toISODate(day);
                          const closed = isPlanningSlotClosed(idx, dayKey, slot.key, closures);
                          const lastOfDay = slotIdx === HALF_DAY_SLOTS.length - 1;
                          return (
                            <th
                              key={`${dayKey}_${slot.key}`}
                              className={`min-w-[130px] border-b border-slate-200 p-2 text-center text-sm font-semibold ${
                                lastOfDay ? "border-r border-r-slate-200" : "border-r border-slate-200"
                              } ${
                                closed
                                  ? "bg-slate-200/70 text-slate-600"
                                  : isToday
                                    ? "bg-(--cf-blue)/5 text-slate-700"
                                    : "text-slate-600"
                              }`}
                            >
                              {closed ? "Fermé" : slot.label}
                            </th>
                          );
                        });
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployeeGroups.map((group) => (
                      <EmployeeGroup
                        key={group.key}
                        label={group.label}
                        users={group.users}
                        weekDays={weekDays}
                        todayISO={todayISO}
                        planningByCell={planningByCell}
                        totalMinutesByUser={totalMinutesByUser}
                        showTotal
                        {...slotHandlers}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card title="Imprimer le planning">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="print-scope" className="mb-1 block text-sm font-medium text-slate-600">
              Ce qui sera imprimé
            </label>
            <select
              id="print-scope"
              value={printScope}
              onChange={(e) => setPrintScope(e.target.value)}
              disabled={loading || noEmployees}
              className="w-full max-w-md rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 disabled:opacity-50"
            >
              <option value="ALL">Tout le planning (avec feuille d&apos;émargement)</option>
              {employeeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.users.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1.5 max-w-md text-xs text-slate-500">
              En sélectionnant « Tout le planning », une ligne vierge est ajoutée sous les horaires de
              chaque employé pour la signature de présence de chaque demi-journée. En sélectionnant une
              personne, seul son planning personnel est imprimé.
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            disabled={loading || noEmployees}
            className="w-full justify-center sm:w-auto"
          >
            🖨️ Imprimer
          </Button>
        </div>
      </Card>
    </div>

    <PrintableSchedule
      weekDays={weekDays}
      groups={visibleEmployeeGroups}
      planningByCell={planningByCell}
      absenceByUserDay={absenceByUserDay}
      closures={closures}
      totalMinutesByUser={totalMinutesByUser}
      scope={printScope}
      selectedUser={selectedPrintUser}
      siteName={
        visibleEmployeeGroups.flatMap((g) => g.users).find((u) => u.site?.name)?.site?.name ?? null
      }
      categoryLabel={CATEGORY_DEFS.find((c) => c.key === selectedCategory)?.label ?? null}
    />

    {closureModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="closure-modal-title"
        onClick={() => !closureSaving && setClosureModalOpen(false)}
      >
        <form
          onSubmit={submitClosure}
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="closure-modal-title" className="text-lg font-semibold text-slate-800">
            Saisir une fermeture
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Bloque toutes les demi-journées pour tous les employés, à partir de la demi-journée
            choisie jusqu&apos;à la date de fin incluse.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Date de début
              <input
                type="date"
                required
                value={closureStart}
                onChange={(e) => setClosureStart(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Demi-journée de début
              <select
                required
                value={closureHalfDay}
                onChange={(e) => setClosureHalfDay(e.target.value as HalfDayKey)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                {HALF_DAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Date de fin
              <input
                type="date"
                required
                value={closureEnd}
                min={closureStart || undefined}
                onChange={(e) => setClosureEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={closureSaving}
              onClick={() => setClosureModalOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={closureSaving}>
              {closureSaving ? "Enregistrement…" : "Valider"}
            </Button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}

/** LAD et hôtes/hôtesses peuvent être affectés en caisse pour un créneau. */
function canMarkEnCaisse(user: User): boolean {
  return Boolean(user.roles?.includes("ROLE_LAD") || user.roles?.includes("ROLE_HOTE"));
}

/** Couleur de fond d'une demi-journée selon le poste (caisse / LAD / accueil). */
type SlotDutyTone = "caisse" | "lad" | "hote" | "default";

function slotDutyTone(user: User, entry: Planning): SlotDutyTone {
  if (entry.enCaisse || user.roles?.includes("ROLE_CAISSIER")) return "caisse";
  if (user.roles?.includes("ROLE_LAD")) return "lad";
  if (user.roles?.includes("ROLE_HOTE")) return "hote";
  return "default";
}

const SLOT_DUTY_CELL_CLASS: Record<SlotDutyTone, string> = {
  // Orange pâle : poste caisse (caissiers, ou LAD/hôte coché « En caisse »)
  caisse:
    "border-orange-300 bg-orange-100 text-orange-900 hover:border-red-400 hover:bg-red-50 hover:text-red-700",
  // Bleu pétant : demi-journée LAD (poste LAD)
  lad: "border-blue-700 bg-blue-600 text-white hover:border-red-400 hover:bg-red-50 hover:text-red-700",
  // Bleu clair (lisible) : demi-journée hôte / hôtesse d'accueil
  hote:
    "border-sky-400 bg-sky-200 text-sky-950 hover:border-red-400 hover:bg-red-50 hover:text-red-700",
  default:
    "border-(--cf-blue)/30 bg-(--cf-blue)/10 text-cf-blue hover:border-red-300 hover:bg-red-50 hover:text-red-600",
};

const SLOT_DUTY_PRINT_CLASS: Record<SlotDutyTone, string> = {
  caisse: "print-schedule__slot-cell--caisse",
  lad: "print-schedule__slot-cell--lad",
  hote: "print-schedule__slot-cell--hote",
  default: "print-schedule__slot-cell--filled",
};

type SlotHandlers = {
  pendingKey: string | null;
  editingCell: string | null;
  formStart: string;
  formEnd: string;
  formEnCaisse: boolean;
  absenceByUserDay: Map<string, Absence>;
  closures: StoreClosure[];
  onFormStartChange: (v: string) => void;
  onFormEndChange: (v: string) => void;
  onFormEnCaisseChange: (v: boolean) => void;
  onStartAdd: (user: User, dayKey: string, slotKey: HalfDayKey, dayIndex: number) => void;
  onCancelAdd: () => void;
  onSubmitAdd: (e: FormEvent, user: User, dayKey: string, cellKey: string, slotKey: HalfDayKey) => void;
  onRemove: (planning: Planning, cellKey: string) => void;
};

function totalColorClassFor(user: User, totalMinutes: number): string {
  const contractMinutes = user.contractMinutes ?? 0;
  if (contractMinutes <= 0) return "bg-slate-50 text-slate-600";
  return totalMinutes > contractMinutes
    ? "bg-red-50 text-red-700"
    : "bg-emerald-50 text-emerald-700";
}

/** Colonne Total collée à droite du viewport de scroll (pas au milieu du tableau). */
const TOTAL_COL_CLASS =
  "planning-col-total w-[5.75rem] min-w-[5.75rem] max-w-[5.75rem] border-l-2 border-slate-300 text-center align-middle";

/** Contenu interactif d'une case matin/après-midi (ajout, édition, retrait). */
function SlotCell({
  user,
  dayKey,
  dayIndex,
  slot,
  entry,
  absence,
  isPending,
  isEditing,
  formStart,
  formEnd,
  formEnCaisse,
  onFormStartChange,
  onFormEndChange,
  onFormEnCaisseChange,
  onStartAdd,
  onCancelAdd,
  onSubmitAdd,
  onRemove,
}: {
  user: User;
  dayKey: string;
  dayIndex: number;
  slot: (typeof HALF_DAY_SLOTS)[number];
  entry: Planning | undefined;
  absence: Absence | undefined;
  isPending: boolean;
  isEditing: boolean;
  formStart: string;
  formEnd: string;
  formEnCaisse: boolean;
  onFormStartChange: (v: string) => void;
  onFormEndChange: (v: string) => void;
  onFormEnCaisseChange: (v: boolean) => void;
  onStartAdd: (user: User, dayKey: string, slotKey: HalfDayKey, dayIndex: number) => void;
  onCancelAdd: () => void;
  onSubmitAdd: (e: FormEvent, user: User, dayKey: string, cellKey: string, slotKey: HalfDayKey) => void;
  onRemove: (planning: Planning, cellKey: string) => void;
}) {
  const cellKey = `${user.id}_${dayKey}_${slot.key}`;
  const minStart = earliestStartForUser(user, slot.key, dayIndex);
  const maxEnd = latestEndForDay(dayIndex);
  // Le dimanche, la fermeture (13h15) borne aussi le début du créneau.
  const maxStart = slot.end <= maxEnd ? slot.end : maxEnd;
  const showEnCaisse = canMarkEnCaisse(user);

  if (absence) {
    const isConge = absence.reason === "CONGE";
    const arretRange =
      !isConge && absence.startTime && absence.endTime
        ? `${formatFrenchTime(absence.startTime)} - ${formatFrenchTime(absence.endTime)}`
        : null;
    return (
      <div
        role="status"
        aria-label={
          isConge
            ? `Congé — ${user.firstName} ${user.lastName}`
            : `Arrêt de travail — ${user.firstName} ${user.lastName}`
        }
        title={isConge ? "Congé" : arretRange ? `Arrêt de travail ${arretRange}` : "Arrêt de travail"}
        className={`flex min-h-11 w-full items-center justify-center rounded-md border-2 px-1 text-[11px] font-semibold leading-tight ${
          isConge
            ? "border-red-400 bg-red-100 text-red-800"
            : "border-slate-700 bg-slate-900 text-white"
        }`}
      >
        {arretRange}
      </div>
    );
  }

  if (isEditing) {
    return (
      <form
        onSubmit={(e) => onSubmitAdd(e, user, dayKey, cellKey, slot.key)}
        className="flex flex-col gap-1.5 rounded-md border border-slate-300 bg-white p-2 shadow-sm"
      >
        <TimeField
          required
          autoFocus
          min={minStart}
          max={maxStart}
          value={formStart}
          onChange={onFormStartChange}
          className="w-full rounded-md border border-slate-300 px-1.5 py-1.5 text-sm"
        />
        <TimeField
          required
          min={formStart || minStart}
          max={maxEnd}
          value={formEnd}
          onChange={onFormEndChange}
          className="w-full rounded-md border border-slate-300 px-1.5 py-1.5 text-sm"
        />
        {showEnCaisse && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={formEnCaisse}
              onChange={(e) => onFormEnCaisseChange(e.target.checked)}
              className="size-3.5 rounded border-slate-300 text-cf-blue focus:ring-cf-blue"
            />
            En caisse
          </label>
        )}
        <div className="flex gap-1">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full justify-center px-1 py-1.5 text-xs"
          >
            OK
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center px-1 py-1.5 text-xs"
            onClick={onCancelAdd}
          >
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  if (entry) {
    const duty = slotDutyTone(user, entry);
    return (
      <button
        type="button"
        title={`Retirer ${user.firstName} ${user.lastName}`}
        disabled={isPending}
        onClick={() => onRemove(entry, cellKey)}
        className={`flex min-h-11 w-full flex-col items-center justify-center rounded-md border-2 py-2.5 transition disabled:opacity-50 ${SLOT_DUTY_CELL_CLASS[duty]}`}
      >
        <span className="text-sm font-bold">
          {formatFrenchTime(entry.startTime)} - {formatFrenchTime(entry.endTime)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      title={`Choisir les heures pour ${user.firstName} ${user.lastName}`}
      disabled={isPending}
      onClick={() => onStartAdd(user, dayKey, slot.key, dayIndex)}
      className="flex min-h-11 w-full items-center justify-center rounded-md border-2 border-dashed border-slate-400 py-2.5 text-lg font-bold text-slate-500 transition hover:border-cf-blue hover:bg-(--cf-blue)/5 hover:text-cf-blue disabled:opacity-50"
    >
      +
    </button>
  );
}

/** Vue mobile/tablette : une carte par employé avec les jours empilés. */
function MobileEmployeeGroup({
  label,
  users,
  weekDays,
  todayISO,
  planningByCell,
  totalMinutesByUser,
  pendingKey,
  editingCell,
  formStart,
  formEnd,
  formEnCaisse,
  absenceByUserDay,
  closures,
  onFormStartChange,
  onFormEndChange,
  onFormEnCaisseChange,
  onStartAdd,
  onCancelAdd,
  onSubmitAdd,
  onRemove,
}: {
  label: string;
  users: User[];
  weekDays: Date[];
  todayISO: string;
  planningByCell: Map<string, Planning>;
  totalMinutesByUser: Map<number, number>;
} & SlotHandlers) {
  if (users.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {users.map((user) => {
        const totalMinutes = totalMinutesByUser.get(user.id) ?? 0;
        const contractMinutes = user.contractMinutes ?? 0;
        const totalColorClass = totalColorClassFor(user, totalMinutes);

        return (
          <article
            key={user.id}
            className="overflow-hidden rounded-md border border-slate-200 bg-white"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-800">
                  {user.firstName} {user.lastName}
                </h3>
                {contractMinutes > 0 && (
                  <p className="text-xs text-slate-500">
                    Contrat {formatMinutesAsHours(contractMinutes)}
                  </p>
                )}
              </div>
              <div
                className={`shrink-0 rounded-md px-2.5 py-1 text-center text-sm font-semibold ${totalColorClass}`}
              >
                {formatMinutesAsHours(totalMinutes)}
              </div>
            </header>
            <div className="divide-y divide-slate-200">
              {weekDays.map((day, idx) => {
                const dayKey = toISODate(day);
                const isToday = dayKey === todayISO;
                return (
                  <div
                    key={dayKey}
                    className={`px-3 py-2.5 ${isToday ? "bg-(--cf-blue)/4" : ""}`}
                  >
                    <p
                      className={`mb-2 text-sm font-semibold ${
                        isToday ? "text-cf-blue" : "text-slate-600"
                      }`}
                    >
                      {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                      {isToday && (
                        <span className="ml-1.5 inline-block rounded-full bg-cf-blue px-2 py-0.5 text-[10px] font-semibold text-white align-middle">
                          Aujourd&apos;hui
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {HALF_DAY_SLOTS.map((slot) => {
                        const closed = isPlanningSlotClosed(idx, dayKey, slot.key, closures);
                        const cellKey = `${user.id}_${dayKey}_${slot.key}`;
                        return (
                          <div key={slot.key} className="min-w-0">
                            <p className="mb-1 text-xs font-medium text-slate-500">
                              {closed ? "Fermé" : slot.label}
                            </p>
                            {closed ? (
                              <div className="flex min-h-11 items-center justify-center rounded-md bg-slate-100 text-sm font-medium text-slate-500">
                                —
                              </div>
                            ) : (
                              <SlotCell
                                user={user}
                                dayKey={dayKey}
                                dayIndex={idx}
                                slot={slot}
                                entry={planningByCell.get(cellKey)}
                                absence={absenceByUserDay.get(`${user.id}_${dayKey}`)}
                                isPending={pendingKey === cellKey}
                                isEditing={editingCell === cellKey}
                                formStart={formStart}
                                formEnd={formEnd}
                                formEnCaisse={formEnCaisse}
                                onFormStartChange={onFormStartChange}
                                onFormEndChange={onFormEndChange}
                                onFormEnCaisseChange={onFormEnCaisseChange}
                                onStartAdd={onStartAdd}
                                onCancelAdd={onCancelAdd}
                                onSubmitAdd={onSubmitAdd}
                                onRemove={onRemove}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EmployeeGroup({
  label,
  users,
  weekDays,
  todayISO,
  planningByCell,
  totalMinutesByUser,
  showTotal = true,
  pendingKey,
  editingCell,
  formStart,
  formEnd,
  formEnCaisse,
  absenceByUserDay,
  closures,
  onFormStartChange,
  onFormEndChange,
  onFormEnCaisseChange,
  onStartAdd,
  onCancelAdd,
  onSubmitAdd,
  onRemove,
}: {
  label: string;
  users: User[];
  weekDays: Date[];
  todayISO: string;
  planningByCell: Map<string, Planning>;
  totalMinutesByUser: Map<number, number>;
  showTotal?: boolean;
} & SlotHandlers) {
  if (users.length === 0) return null;

  // Trait plus marqué entre les lignes de caissiers et d'hôtes ; toujours
  // marqué sous la dernière ligne d'un groupe (ex. LAD → Hôtes).
  const thickBetweenRows =
    label === "Caissiers" || label === "Hôtes / hôtesses d'accueil";

  return (
    <>
      <tr>
        <td className="planning-col-employee sticky left-0 z-20 whitespace-nowrap border-b-2 border-r-2 border-slate-300 bg-slate-100 px-2.5 py-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          {label}
        </td>
        <td
          colSpan={weekDays.length * HALF_DAY_SLOTS.length}
          className="border-b-2 border-slate-300 bg-slate-100"
        />
        {showTotal && (
          <td
            className={`${TOTAL_COL_CLASS} planning-col-total-sticky sticky right-0 z-20 border-b-2 border-slate-300 bg-slate-100`}
          >
            &nbsp;
          </td>
        )}
      </tr>
      {users.map((user, rowIndex) => {
        const totalMinutes = totalMinutesByUser.get(user.id) ?? 0;
        const contractMinutes = user.contractMinutes ?? 0;
        const totalColorClass = totalColorClassFor(user, totalMinutes);
        const rowBg = rowIndex % 2 === 1 ? "bg-slate-50" : "bg-white";
        const isLast = rowIndex === users.length - 1;
        const thick = isLast || thickBetweenRows;
        const rowBorder = thick ? "border-b-2 border-slate-400" : "border-b border-slate-200";
        const nameBorder = thick ? "border-b-2 border-slate-400" : "border-b border-slate-300";

        return (
          <tr key={user.id} className={`group ${rowBg} hover:bg-sky-50`}>
            <td
              className={`planning-col-employee sticky left-0 z-20 ${nameBorder} border-r-2 border-slate-300 p-2.5 text-left font-semibold text-slate-800 ${rowBg} transition-colors group-hover:bg-sky-50`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {user.firstName} {user.lastName}
                </span>
                {contractMinutes > 0 && (
                  <span className="whitespace-nowrap text-sm font-medium text-slate-500">
                    {formatMinutesAsHours(contractMinutes)}
                  </span>
                )}
              </div>
            </td>
            {weekDays.map((day, idx) =>
              HALF_DAY_SLOTS.map((slot, slotIdx) => {
                const dayKey = toISODate(day);
                const cellKey = `${user.id}_${dayKey}_${slot.key}`;
                const closed = isPlanningSlotClosed(idx, dayKey, slot.key, closures);
                const isToday = dayKey === todayISO;
                const lastOfDay = slotIdx === HALF_DAY_SLOTS.length - 1;
                const dayBorder = lastOfDay ? "border-r border-r-slate-200" : "border-r border-slate-200";

                if (closed) {
                  return (
                    <td
                      key={cellKey}
                      className={`${rowBorder} bg-slate-100 p-1.5 text-center font-medium text-slate-500 ${dayBorder}`}
                    >
                      —
                    </td>
                  );
                }

                return (
                  <td
                    key={cellKey}
                    className={`${rowBorder} p-1.5 ${dayBorder} ${
                      isToday ? "bg-(--cf-blue)/4" : ""
                    }`}
                  >
                    <SlotCell
                      user={user}
                      dayKey={dayKey}
                      dayIndex={idx}
                      slot={slot}
                      entry={planningByCell.get(cellKey)}
                      absence={absenceByUserDay.get(`${user.id}_${dayKey}`)}
                      isPending={pendingKey === cellKey}
                      isEditing={editingCell === cellKey}
                      formStart={formStart}
                      formEnd={formEnd}
                      formEnCaisse={formEnCaisse}
                      onFormStartChange={onFormStartChange}
                      onFormEndChange={onFormEndChange}
                      onFormEnCaisseChange={onFormEnCaisseChange}
                      onStartAdd={onStartAdd}
                      onCancelAdd={onCancelAdd}
                      onSubmitAdd={onSubmitAdd}
                      onRemove={onRemove}
                    />
                  </td>
                );
              }),
            )}
            {showTotal && (
              <td
                className={`${TOTAL_COL_CLASS} planning-col-total-sticky sticky right-0 z-20 ${nameBorder} px-2 py-2.5 text-sm font-bold tabular-nums ${totalColorClass}`}
              >
                {formatMinutesAsHours(totalMinutes)}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}

/**
 * Vue imprimable du planning, indépendante de la grille interactive à
 * l'écran (masquée en dehors de l'impression via `hidden print:block`).
 *
 * Document soigné type feuille magasin : en-tête marque, méta-semaine,
 * tableau coloré, légende et pied de page. Si `scope` vaut "ALL", une
 * ligne de signature est ajoutée sous chaque employé.
 */
function PrintableSchedule({
  weekDays,
  groups,
  planningByCell,
  absenceByUserDay,
  closures,
  totalMinutesByUser,
  scope,
  selectedUser,
  siteName,
  categoryLabel,
}: {
  weekDays: Date[];
  groups: { label: string; users: User[] }[];
  planningByCell: Map<string, Planning>;
  absenceByUserDay: Map<string, Absence>;
  closures: StoreClosure[];
  totalMinutesByUser: Map<number, number>;
  scope: string;
  selectedUser: User | null;
  siteName: string | null;
  categoryLabel: string | null;
}) {
  const visibleGroups =
    scope === "ALL"
      ? groups
      : groups
          .map((group) => ({
            ...group,
            users: group.users.filter((u) => String(u.id) === scope),
          }))
          .filter((group) => group.users.length > 0);

  const columnCount = 2 + weekDays.length * HALF_DAY_SLOTS.length;
  const printedAt = new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function totalTone(user: User, totalMinutes: number): "ok" | "over" | "neutral" {
    const contractMinutes = user.contractMinutes ?? 0;
    if (contractMinutes <= 0) return "neutral";
    return totalMinutes > contractMinutes ? "over" : "ok";
  }

  /** Format compact une ligne pour l'impression (ex. 7h30-14h). */
  function formatPrintRange(start: string, end: string): string {
    const fmt = (time: string) => {
      const [hRaw, mRaw] = time.split(":");
      if (hRaw == null || mRaw == null) return time;
      const h = String(Number.parseInt(hRaw, 10));
      return mRaw === "00" ? `${h}h` : `${h}h${mRaw}`;
    };
    return `${fmt(start)}-${fmt(end)}`;
  }

  return (
    <div className="print-schedule hidden print:block">
      <header className="print-schedule__brand">
        <div className="print-schedule__brand-left">
          {/* eslint-disable-next-line @next/next/no-img-element -- img classique plus fiable à l'impression */}
          <img
            src="/carrefour-logo.png"
            alt="Carrefour"
            className="print-schedule__logo"
            width={22}
            height={22}
          />
          <div>
            <div className="print-schedule__brand-name">ShiftDesk</div>
            <div className="print-schedule__brand-tag">Gestion de l&apos;accueil</div>
          </div>
        </div>
        <div className="print-schedule__doc-title">
          <h1>
            Planning hebdomadaire
            {selectedUser ? ` — ${selectedUser.firstName} ${selectedUser.lastName}` : ""}
          </h1>
          <p>{siteName ?? "Document interne"}</p>
        </div>
      </header>

      <div className="print-schedule__meta">
        <span>
          <strong>Semaine</strong> du {weekDays[0].toLocaleDateString("fr-FR")} au{" "}
          {weekDays[6].toLocaleDateString("fr-FR")}
        </span>
        {categoryLabel && (
          <span>
            <strong>Catégorie</strong> {categoryLabel}
          </span>
        )}
        <span>
          <strong>Édité le</strong> {printedAt}
        </span>
        {scope === "ALL" && (
          <span>
            <strong>Émargement</strong> ligne signature sous chaque agent
          </span>
        )}
      </div>

      <table className="print-schedule__table">
        <thead>
          <tr>
            <th rowSpan={2} className="print-schedule__employee">
              Employé
            </th>
            {weekDays.map((day, idx) => (
              <th
                key={toISODate(day)}
                colSpan={HALF_DAY_SLOTS.length}
                className="print-schedule__day"
              >
                {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
              </th>
            ))}
            <th rowSpan={2} className="print-schedule__total">
              Total
            </th>
          </tr>
          <tr>
            {weekDays.map((day, idx) =>
              HALF_DAY_SLOTS.map((slot, slotIdx) => {
                const dayKey = toISODate(day);
                const closed = isPlanningSlotClosed(idx, dayKey, slot.key, closures);
                const dayEnd = slotIdx === HALF_DAY_SLOTS.length - 1;
                const halfEnd = !dayEnd;
                return (
                  <th
                    key={`${dayKey}_${slot.key}`}
                    className={[
                      "print-schedule__slot",
                      closed ? "print-schedule__slot--closed" : "",
                      halfEnd ? "print-schedule__half-end" : "",
                      dayEnd ? "print-schedule__day-end" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {closed ? "Fermé" : slot.label}
                  </th>
                );
              }),
            )}
          </tr>
        </thead>
        <tbody>
          {visibleGroups.map((group) => (
            <Fragment key={group.label}>
              <tr className="print-schedule__group">
                <td colSpan={columnCount}>{group.label}</td>
              </tr>
              {group.users.map((user) => {
                const totalMinutes = totalMinutesByUser.get(user.id) ?? 0;
                const tone = totalTone(user, totalMinutes);
                const withSignature = scope === "ALL";
                return (
                  <Fragment key={user.id}>
                    <tr
                      className={[
                        "print-schedule__hours",
                        withSignature ? "" : "print-schedule__hours--solo",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td
                        rowSpan={withSignature ? 2 : 1}
                        className="print-schedule__name"
                      >
                        {user.firstName} {user.lastName}
                        {(user.contractMinutes ?? 0) > 0 && (
                          <span className="print-schedule__contract">
                            · {formatMinutesAsHours(user.contractMinutes ?? 0)}
                          </span>
                        )}
                      </td>
                      {weekDays.map((day, idx) =>
                        HALF_DAY_SLOTS.map((slot, slotIdx) => {
                          const dayKey = toISODate(day);
                          const closed = isPlanningSlotClosed(idx, dayKey, slot.key, closures);
                          const absence = absenceByUserDay.get(`${user.id}_${dayKey}`);
                          const entry = planningByCell.get(`${user.id}_${dayKey}_${slot.key}`);
                          const dayEnd = slotIdx === HALF_DAY_SLOTS.length - 1;
                          const halfEnd = !dayEnd;
                          const dayAlt = idx % 2 === 1;
                          return (
                            <td
                              key={`${dayKey}_${slot.key}`}
                              className={[
                                closed
                                  ? "print-schedule__slot-cell--closed"
                                  : absence
                                    ? absence.reason === "CONGE"
                                      ? "print-schedule__slot-cell--conge"
                                      : "print-schedule__slot-cell--arret"
                                    : entry
                                      ? SLOT_DUTY_PRINT_CLASS[slotDutyTone(user, entry)]
                                      : "",
                                halfEnd ? "print-schedule__half-end" : "",
                                dayEnd ? "print-schedule__day-end" : "",
                                dayAlt && !absence ? "print-schedule__day-band--alt" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              style={{ textAlign: "center" }}
                            >
                              {closed ? (
                                "—"
                              ) : absence ? (
                                absence.reason === "ARRET_TRAVAIL" &&
                                absence.startTime &&
                                absence.endTime ? (
                                  <span className="print-schedule__time">
                                    {formatPrintRange(absence.startTime, absence.endTime)}
                                  </span>
                                ) : (
                                  ""
                                )
                              ) : entry ? (
                                <span className="print-schedule__time">
                                  {formatPrintRange(entry.startTime, entry.endTime)}
                                </span>
                              ) : (
                                ""
                              )}
                            </td>
                          );
                        }),
                      )}
                      <td
                        rowSpan={withSignature ? 2 : 1}
                        className={`print-schedule__total print-schedule__total--${tone}`}
                      >
                        {formatMinutesAsHours(totalMinutes)}
                      </td>
                    </tr>
                    {withSignature && (
                      <tr className="print-schedule__sig">
                        {weekDays.map((day, idx) =>
                          HALF_DAY_SLOTS.map((slot, slotIdx) => {
                            const dayKey = toISODate(day);
                            const closed = isPlanningSlotClosed(idx, dayKey, slot.key, closures);
                            const absence = absenceByUserDay.get(`${user.id}_${dayKey}`);
                            const dayEnd = slotIdx === HALF_DAY_SLOTS.length - 1;
                            const halfEnd = !dayEnd;
                            const dayAlt = idx % 2 === 1;
                            return (
                              <td
                                key={`${dayKey}_${slot.key}_sig`}
                                className={[
                                  closed || absence
                                    ? "print-schedule__slot-cell--closed"
                                    : "",
                                  absence ? "print-schedule__sig--blocked" : "",
                                  halfEnd ? "print-schedule__half-end" : "",
                                  dayEnd ? "print-schedule__day-end" : "",
                                  dayAlt && !absence ? "print-schedule__day-band--alt" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              />
                            );
                          }),
                        )}
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>

      <div className="print-schedule__legend">
        <span>
          <span className="print-schedule__swatch" style={{ background: "#ffedd5" }} />
          Caisse
        </span>
        <span>
          <span className="print-schedule__swatch" style={{ background: "#2563eb" }} />
          LAD
        </span>
        <span>
          <span className="print-schedule__swatch" style={{ background: "#bae6fd" }} />
          Accueil
        </span>
        <span>
          <span className="print-schedule__swatch" style={{ background: "#111827" }} />
          Arrêt
        </span>
        <span>
          <span className="print-schedule__swatch" style={{ background: "#fecaca" }} />
          Congé
        </span>
        <span>
          <span className="print-schedule__swatch" style={{ background: "#e5e9ef" }} />
          Magasin fermé
        </span>
        <span>
          <span className="print-schedule__swatch" style={{ background: "#d1fae5" }} />
          Total ≤ contrat
        </span>
        <span>
          <span className="print-schedule__swatch" style={{ background: "#fee2e2" }} />
          Total &gt; contrat
        </span>
        {scope === "ALL" && (
          <span>
            <span
              className="print-schedule__swatch"
              style={{ background: "#fff", height: "0.55rem" }}
            />
            Case signature / émargement
          </span>
        )}
      </div>
      <p className="print-schedule__footer">
        ShiftDesk — document généré automatiquement · usage interne uniquement
      </p>
    </div>
  );
}
