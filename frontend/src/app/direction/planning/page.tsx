"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Button, Alert, TimeField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import {
  addHours,
  DAY_LABELS,
  durationMinutes,
  formatFrenchTime,
  formatMinutesAsHours,
  HALF_DAY_SLOTS,
  isClosedSlot,
  slotKeyForTime,
  STORE_CLOSE,
  type HalfDayKey,
} from "@/lib/planning";
import type { Planning, User } from "@/lib/types";

/**
 * Catégorie de planning affichée : "Caisse" regroupe les caissiers/caissières
 * et les hôtes/hôtesses d'accueil (front de magasin), les 3 autres sont des
 * services distincts. Une seule catégorie est affichée à la fois, choisie
 * via le select en haut de la grille.
 */
type PlanningCategory = "CAISSE" | "DIRECTION" | "RAYON" | "SECURITE";

const CATEGORY_OPTIONS: { value: PlanningCategory; label: string }[] = [
  { value: "CAISSE", label: "Caisse" },
  { value: "DIRECTION", label: "Direction" },
  { value: "RAYON", label: "Rayon" },
  { value: "SECURITE", label: "Sécurité" },
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
  const [category, setCategory] = useState<PlanningCategory>("CAISSE");
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [caissiers, setCaissiers] = useState<User[]>([]);
  const [hotes, setHotes] = useState<User[]>([]);
  const [directionStaff, setDirectionStaff] = useState<User[]>([]);
  const [rayon, setRayon] = useState<User[]>([]);
  const [securite, setSecurite] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Case en cours d'édition (ajout d'un horaire) : la direction choisit
  // elle-même l'heure de début/fin, pré-remplies avec la plage par défaut
  // de la demi-journée (matin/après-midi) mais librement modifiables.
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

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
      const [planningData, usersData] = await Promise.all([
        api.get<Planning[]>(`/api/plannings?from=${from}&to=${to}`),
        api.get<User[]>("/api/users"),
      ]);
      setPlannings(planningData);
      setCaissiers(usersData.filter((u) => u.roles?.includes("ROLE_CAISSIER")));
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

  // Total d'heures planifiées sur la semaine, par employé (toutes demi-
  // journées confondues), pour la colonne "Total" et son code couleur.
  const totalMinutesByUser = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of plannings) {
      const mins = durationMinutes(p.startTime, p.endTime);
      map.set(p.user.id, (map.get(p.user.id) ?? 0) + mins);
    }
    return map;
  }, [plannings]);

  function startAdd(user: User, dayKey: string, slotKey: HalfDayKey) {
    const cellKey = `${user.id}_${dayKey}_${slotKey}`;
    const slot = HALF_DAY_SLOTS.find((s) => s.key === slotKey);
    let defaultStart = slot?.start ?? "07:30";
    const defaultEnd = slot?.end ?? "20:15";

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
  }

  function cancelAdd() {
    setEditingCell(null);
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
      });
      setEditingCell(null);
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

  // La catégorie "Caisse" regroupe caissiers/caissières ET hôtes/hôtesses
  // d'accueil ; les autres catégories affichent un seul groupe dédié.
  const categoryIsEmpty =
    category === "CAISSE"
      ? caissiers.length === 0 && hotes.length === 0
      : category === "DIRECTION"
        ? directionStaff.length === 0
        : category === "RAYON"
          ? rayon.length === 0
          : securite.length === 0;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? "";
  const todayISO = toISODate(new Date());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Planning</h1>
          <p className="text-sm text-slate-500">
            Cliquez sur une case <strong className="font-semibold text-slate-600">vide (+)</strong> pour
            planifier un créneau, ou sur un <strong className="font-semibold text-slate-600">créneau
            existant</strong> pour le retirer. Seule la direction peut modifier le planning ; chaque
            employé ne voit que son planning personnel. Le dimanche après-midi est fermé.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 p-1">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                aria-pressed={category === c.value}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  category === c.value
                    ? "bg-[var(--cf-blue)] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => setWeekStart((d) => {
              const nd = new Date(d);
              nd.setDate(nd.getDate() - 7);
              return nd;
            })}
          >
            ← Semaine précédente
          </Button>
          <Button
            variant="secondary"
            onClick={() => setWeekStart((d) => {
              const nd = new Date(d);
              nd.setDate(nd.getDate() + 7);
              return nd;
            })}
          >
            Semaine suivante →
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title={`Planning ${categoryLabel} — Semaine du ${weekDays[0].toLocaleDateString("fr-FR")} au ${weekDays[6].toLocaleDateString("fr-FR")}`}>
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : categoryIsEmpty ? (
          <p className="text-sm text-slate-500">Aucun employé enregistré dans cette catégorie.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[1320px] border-collapse text-base">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-10 min-w-[190px] border-b-2 border-r-2 border-slate-300 bg-slate-50 p-2.5 text-left align-bottom text-base font-semibold text-slate-700 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.15)]"
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
                      className="sm:sticky sm:right-0 sm:z-10 min-w-[100px] border-b-2 border-l-2 border-slate-300 bg-slate-50 p-2.5 text-center align-bottom font-semibold text-slate-600 sm:shadow-[-4px_0_6px_-4px_rgba(15,23,42,0.15)]"
                    >
                      Total
                    </th>
                  </tr>
                  <tr>
                    {weekDays.map((day, idx) => {
                      const isToday = toISODate(day) === todayISO;
                      return HALF_DAY_SLOTS.map((slot, slotIdx) => {
                        const closed = isClosedSlot(idx, slot.key);
                        const lastOfDay = slotIdx === HALF_DAY_SLOTS.length - 1;
                        return (
                          <th
                            key={`${toISODate(day)}_${slot.key}`}
                            className={`min-w-[130px] border-b border-slate-200 p-2 text-center text-sm font-semibold ${
                              lastOfDay ? "border-r-2 border-r-slate-300" : "border-r border-slate-200"
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
                  {category === "CAISSE" && (
                    <>
                      <EmployeeGroup
                        label="Caissiers"
                        users={caissiers}
                        weekDays={weekDays}
                        todayISO={todayISO}
                        planningByCell={planningByCell}
                        totalMinutesByUser={totalMinutesByUser}
                        pendingKey={pendingKey}
                        editingCell={editingCell}
                        formStart={formStart}
                        formEnd={formEnd}
                        onFormStartChange={setFormStart}
                        onFormEndChange={setFormEnd}
                        onStartAdd={startAdd}
                        onCancelAdd={cancelAdd}
                        onSubmitAdd={submitAdd}
                        onRemove={removeSlot}
                      />
                      <EmployeeGroup
                        label="Hôtes / hôtesses d'accueil"
                        users={hotes}
                        weekDays={weekDays}
                        todayISO={todayISO}
                        planningByCell={planningByCell}
                        totalMinutesByUser={totalMinutesByUser}
                        pendingKey={pendingKey}
                        editingCell={editingCell}
                        formStart={formStart}
                        formEnd={formEnd}
                        onFormStartChange={setFormStart}
                        onFormEndChange={setFormEnd}
                        onStartAdd={startAdd}
                        onCancelAdd={cancelAdd}
                        onSubmitAdd={submitAdd}
                        onRemove={removeSlot}
                      />
                    </>
                  )}
                  {category === "DIRECTION" && (
                    <EmployeeGroup
                      label="Direction"
                      users={directionStaff}
                      weekDays={weekDays}
                      todayISO={todayISO}
                      planningByCell={planningByCell}
                      totalMinutesByUser={totalMinutesByUser}
                      pendingKey={pendingKey}
                      editingCell={editingCell}
                      formStart={formStart}
                      formEnd={formEnd}
                      onFormStartChange={setFormStart}
                      onFormEndChange={setFormEnd}
                      onStartAdd={startAdd}
                      onCancelAdd={cancelAdd}
                      onSubmitAdd={submitAdd}
                      onRemove={removeSlot}
                    />
                  )}
                  {category === "RAYON" && (
                    <EmployeeGroup
                      label="Rayon"
                      users={rayon}
                      weekDays={weekDays}
                      todayISO={todayISO}
                      planningByCell={planningByCell}
                      totalMinutesByUser={totalMinutesByUser}
                      pendingKey={pendingKey}
                      editingCell={editingCell}
                      formStart={formStart}
                      formEnd={formEnd}
                      onFormStartChange={setFormStart}
                      onFormEndChange={setFormEnd}
                      onStartAdd={startAdd}
                      onCancelAdd={cancelAdd}
                      onSubmitAdd={submitAdd}
                      onRemove={removeSlot}
                    />
                  )}
                  {category === "SECURITE" && (
                    <EmployeeGroup
                      label="Sécurité"
                      users={securite}
                      weekDays={weekDays}
                      todayISO={todayISO}
                      planningByCell={planningByCell}
                      totalMinutesByUser={totalMinutesByUser}
                      pendingKey={pendingKey}
                      editingCell={editingCell}
                      formStart={formStart}
                      formEnd={formEnd}
                      onFormStartChange={setFormStart}
                      onFormEndChange={setFormEnd}
                      onStartAdd={startAdd}
                      onCancelAdd={cancelAdd}
                      onSubmitAdd={submitAdd}
                      onRemove={removeSlot}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
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
  pendingKey,
  editingCell,
  formStart,
  formEnd,
  onFormStartChange,
  onFormEndChange,
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
  pendingKey: string | null;
  editingCell: string | null;
  formStart: string;
  formEnd: string;
  onFormStartChange: (v: string) => void;
  onFormEndChange: (v: string) => void;
  onStartAdd: (user: User, dayKey: string, slotKey: HalfDayKey) => void;
  onCancelAdd: () => void;
  onSubmitAdd: (e: FormEvent, user: User, dayKey: string, cellKey: string, slotKey: HalfDayKey) => void;
  onRemove: (planning: Planning, cellKey: string) => void;
}) {
  if (users.length === 0) return null;

  return (
    <>
      <tr>
        <td className="sticky left-0 z-10 border-b-2 border-slate-300 bg-slate-100 px-2.5 py-2 text-sm font-semibold uppercase tracking-wide text-slate-700 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.15)]">
          {label}
        </td>
        <td
          colSpan={weekDays.length * HALF_DAY_SLOTS.length}
          className="border-b-2 border-slate-300 bg-slate-100"
        />
        <td className="sm:sticky sm:right-0 sm:z-10 border-b-2 border-slate-300 bg-slate-100 sm:shadow-[-4px_0_6px_-4px_rgba(15,23,42,0.15)]" />
      </tr>
      {users.map((user, rowIndex) => {
        const totalMinutes = totalMinutesByUser.get(user.id) ?? 0;
        const contractMinutes = user.contractMinutes ?? 0;
        const overContract = contractMinutes > 0 && totalMinutes > contractMinutes;
        const totalColorClass =
          contractMinutes > 0
            ? overContract
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-700"
            : "bg-slate-50 text-slate-500";
        const rowBg = rowIndex % 2 === 1 ? "bg-slate-50/70" : "bg-white";

        return (
        <tr key={user.id} className={`group ${rowBg} hover:bg-(--cf-blue)/6`}>
          <td
            className={`sticky left-0 z-10 border-b border-r-2 border-slate-300 p-2.5 text-left font-semibold text-slate-800 ${rowBg} shadow-[4px_0_6px_-4px_rgba(15,23,42,0.15)] transition-colors group-hover:bg-(--cf-blue)/6`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                {user.firstName} {user.lastName}
              </span>
              {contractMinutes > 0 && (
                <span className="hidden whitespace-nowrap text-sm font-medium text-slate-500 sm:inline">
                  {formatMinutesAsHours(contractMinutes)}
                </span>
              )}
            </div>
          </td>
          {weekDays.map((day, idx) =>
            HALF_DAY_SLOTS.map((slot, slotIdx) => {
              const dayKey = toISODate(day);
              const cellKey = `${user.id}_${dayKey}_${slot.key}`;
              const closed = isClosedSlot(idx, slot.key);
              const entry = planningByCell.get(cellKey);
              const isPending = pendingKey === cellKey;
              const isEditing = editingCell === cellKey;
              const isToday = dayKey === todayISO;
              const lastOfDay = slotIdx === HALF_DAY_SLOTS.length - 1;
              const dayBorder = lastOfDay ? "border-r-2 border-r-slate-300" : "border-r border-slate-200";

              if (closed) {
                return (
                  <td
                    key={cellKey}
                    className={`border-b border-slate-200 bg-slate-100 p-1.5 text-center font-medium text-slate-500 ${dayBorder}`}
                  >
                    —
                  </td>
                );
              }

              return (
                <td
                  key={cellKey}
                  className={`border-b border-slate-200 p-1.5 ${dayBorder} ${
                    isToday ? "bg-(--cf-blue)/4" : ""
                  }`}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => onSubmitAdd(e, user, dayKey, cellKey, slot.key)}
                      className="flex flex-col gap-1.5 rounded-md border border-slate-300 bg-white p-2 shadow-sm"
                    >
                      <TimeField
                        required
                        autoFocus
                        min={slot.start}
                        max={slot.end}
                        value={formStart}
                        onChange={onFormStartChange}
                        className="w-full rounded-md border border-slate-300 px-1.5 py-1.5 text-sm"
                      />
                      <TimeField
                        required
                        min={formStart || slot.start}
                        max={STORE_CLOSE}
                        value={formEnd}
                        onChange={onFormEndChange}
                        className="w-full rounded-md border border-slate-300 px-1.5 py-1.5 text-sm"
                      />
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
                  ) : entry ? (
                    <button
                      type="button"
                      title={`Retirer ${user.firstName} ${user.lastName}`}
                      disabled={isPending}
                      onClick={() => onRemove(entry, cellKey)}
                      className="flex w-full flex-col items-center justify-center rounded-md border-2 border-(--cf-blue)/30 bg-(--cf-blue)/10 py-3 text-cf-blue transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <span className="text-sm font-bold">
                        {formatFrenchTime(entry.startTime)} - {formatFrenchTime(entry.endTime)}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      title={`Choisir les heures pour ${user.firstName} ${user.lastName}`}
                      disabled={isPending}
                      onClick={() => onStartAdd(user, dayKey, slot.key)}
                      className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-slate-400 py-3 text-lg font-bold text-slate-500 transition hover:border-cf-blue hover:bg-(--cf-blue)/5 hover:text-cf-blue disabled:opacity-50"
                    >
                      +
                    </button>
                  )}
                </td>
              );
            }),
          )}
          <td
            className={`sm:sticky sm:right-0 sm:z-10 border-b border-l-2 border-slate-300 p-2 text-center font-semibold sm:shadow-[-4px_0_6px_-4px_rgba(15,23,42,0.15)] ${totalColorClass}`}
          >
            {formatMinutesAsHours(totalMinutes)}
          </td>
        </tr>
        );
      })}
    </>
  );
}
