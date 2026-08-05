"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Button, Alert, WeekNavigator, isoWeekNumber } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import {
  buildReliefAssignment,
  DAY_LABELS,
  durationMinutes,
  formatFrenchTime,
  freeNumberedRegisters,
  HALF_DAY_SLOTS,
  intervalsOverlap,
  isClosedSlot,
  isOnScoAtTime,
  numberedRegisterAtTime,
  pauseMinutesForWork,
  PAUSES_RETOUR_REGISTER,
  planningIntervals,
  printBasculeTimes,
  printRegisters,
  REGISTER_NUMBERS,
  registerLabel,
  registerShortLabel,
  scoReliefTimeOptions,
  SELF_CHECKOUT_REGISTER,
  slotKeyForTime,
  timeInRange,
  type HalfDayKey,
  type RegisterInterval,
} from "@/lib/planning";
import type { Planning, User } from "@/lib/types";

const SCO_RELIEF_TIMES = scoReliefTimeOptions();

type Interval = RegisterInterval;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date): string {
  // Formatage en heure locale (et non toISOString(), qui convertit en UTC
  // et décalerait la date d'un jour selon le fuseau horaire).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function entryIntervals(p: Planning): Interval[] {
  return planningIntervals(p);
}

/** Libellé court du poste d'origine pour un LAD / hôte prévu en caisse. */
function originRoleLabel(user: User): string | null {
  if (user.roles?.includes("ROLE_LAD")) return "LAD";
  if (user.roles?.includes("ROLE_HOTE")) return "Accueil";
  return null;
}

function compareUsersByName(a: User, b: User): number {
  const last = a.lastName.localeCompare(b.lastName, "fr");
  return last !== 0 ? last : a.firstName.localeCompare(b.firstName, "fr");
}

/** Première heure d'arrivée de la semaine (date + heure de début). */
function earliestArrivalKey(plannings: Planning[]): string | null {
  let earliest: string | null = null;
  for (const p of plannings) {
    const key = `${p.workDate}T${p.startTime}`;
    if (earliest === null || key < earliest) earliest = key;
  }
  return earliest;
}

function scoSlotKey(dayKey: string, slotKey: HalfDayKey): string {
  return `${dayKey}_${slotKey}`;
}

/** Caisse affichée à côté d'un candidat relève à une heure donnée. */
function registerLabelAtTime(p: Planning, time: string): string {
  if (!time) {
    if (p.registerSegments && p.registerSegments.length > 0) {
      return p.registerSegments.map((s) => registerShortLabel(s.registerNumber)).join(" → ");
    }
    if (p.registerNumber != null) return registerShortLabel(p.registerNumber);
    return "—";
  }
  const reg = numberedRegisterAtTime(p, time);
  if (reg != null) return registerShortLabel(reg);
  if (isOnScoAtTime(p, time)) return registerShortLabel(SELF_CHECKOUT_REGISTER);
  return "—";
}

export default function PlanDeCaissePage() {
  return (
    <RoleGuard roles={["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <PlanDeCaisseContent />
      </AppShell>
    </RoleGuard>
  );
}

function PlanDeCaisseContent() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [ladPlannings, setLadPlannings] = useState<Planning[]>([]);
  const [caissiers, setCaissiers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Case en cours d'édition (attribution d'une affectation de caisse à un
  // créneau déjà planifié).
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [formRegisterNumber, setFormRegisterNumber] = useState("");

  // Panneau « Caisse auto » : relève SCO (échange ou caisse libre).
  const [scoOpen, setScoOpen] = useState(false);
  const [scoDayIndex, setScoDayIndex] = useState(0);
  const [scoReliefTime, setScoReliefTime] = useState("");
  const [scoTimeMenuOpen, setScoTimeMenuOpen] = useState(false);
  const [scoRelieverId, setScoRelieverId] = useState("");
  const [scoFreeRegister, setScoFreeRegister] = useState("");
  const [scoPending, setScoPending] = useState(false);

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
      const [planningData, ladPlanningData, caissiersData] = await Promise.all([
        api.get<Planning[]>(`/api/plannings?from=${from}&to=${to}&caissiersOnly=1`),
        api.get<Planning[]>(`/api/plannings?from=${from}&to=${to}&ladOnly=1`),
        api.get<User[]>("/api/caissiers"),
      ]);
      setPlannings(planningData);
      setLadPlannings(ladPlanningData);
      setCaissiers(caissiersData);
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

  // Caissiers + LAD / Accueil prévus en caisse cette semaine (créneaux
  // renvoyés par caissiersOnly, absents de /api/caissiers), triés par
  // heure d'arrivée (premier créneau de la semaine).
  const rowUsers = useMemo(() => {
    const byId = new Map<number, User>();
    const planningsByUser = new Map<number, Planning[]>();
    for (const u of caissiers) {
      byId.set(u.id, u);
    }
    for (const p of plannings) {
      if (!byId.has(p.user.id)) {
        byId.set(p.user.id, p.user);
      }
      const list = planningsByUser.get(p.user.id);
      if (list) list.push(p);
      else planningsByUser.set(p.user.id, [p]);
    }
    return Array.from(byId.values()).sort((a, b) => {
      const aKey = earliestArrivalKey(planningsByUser.get(a.id) ?? []);
      const bKey = earliestArrivalKey(planningsByUser.get(b.id) ?? []);
      if (aKey === null && bKey === null) return compareUsersByName(a, b);
      if (aKey === null) return 1;
      if (bKey === null) return -1;
      if (aKey !== bKey) return aKey < bKey ? -1 : 1;
      return compareUsersByName(a, b);
    });
  }, [caissiers, plannings]);

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

  // Couverture des caisses automatiques par jour + demi-journée : le
  // magasin exige au moins un(e) caissier(ère) affecté(e) à leur
  // supervision sur chaque créneau où des caissiers travaillent (que ce
  // soit sur tout le créneau, ou seulement une partie via une bascule).
  const selfCheckoutCoverage = useMemo(() => {
    const map = new Map<string, { hasCaissier: boolean; covered: boolean }>();
    for (const p of plannings) {
      const key = `${p.workDate}_${slotKeyForTime(p.startTime)}`;
      const cur = map.get(key) ?? { hasCaissier: false, covered: false };
      cur.hasCaissier = true;
      if (entryIntervals(p).some((iv) => iv.registerNumber === SELF_CHECKOUT_REGISTER)) {
        cur.covered = true;
      }
      map.set(key, cur);
    }
    return map;
  }, [plannings]);

  // LAD en poste (pas « en caisse ») par jour + demi-journée — pour le pied
  // de page imprimé « LAD en charge ».
  const ladOnDutyBySlot = useMemo(() => {
    const map = new Map<string, Planning[]>();
    for (const p of ladPlannings) {
      if (p.enCaisse) continue;
      if (!p.user.roles?.includes("ROLE_LAD")) continue;
      const key = `${p.workDate}_${slotKeyForTime(p.startTime)}`;
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const byTime = a.startTime.localeCompare(b.startTime);
        return byTime !== 0 ? byTime : compareUsersByName(a.user, b.user);
      });
    }
    return map;
  }, [ladPlannings]);

  // Personnes planifiées par demi-journée, triées par heure d'arrivée.
  const candidatesBySlot = useMemo(() => {
    const map = new Map<string, Planning[]>();
    for (const p of plannings) {
      const key = scoSlotKey(p.workDate, slotKeyForTime(p.startTime));
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const byTime = a.startTime.localeCompare(b.startTime);
        return byTime !== 0 ? byTime : compareUsersByName(a.user, b.user);
      });
    }
    return map;
  }, [plannings]);

  const scoDayKey = toISODate(weekDays[scoDayIndex] ?? weekDays[0]);
  // Le créneau (matin / après-midi) se déduit de l'heure de relève.
  const scoDerivedSlot = scoReliefTime ? slotKeyForTime(scoReliefTime) : null;
  const scoSlotCandidates = scoOpen && scoDerivedSlot
    ? (candidatesBySlot.get(scoSlotKey(scoDayKey, scoDerivedSlot)) ?? [])
    : [];
  // Personnes en service à l'heure choisie (créneau qui couvre l'heure).
  const scoCandidates = useMemo(() => {
    if (!scoReliefTime) return [];
    return scoSlotCandidates.filter((p) => timeInRange(scoReliefTime, p.startTime, p.endTime));
  }, [scoSlotCandidates, scoReliefTime]);

  const scoPerson = useMemo(() => {
    if (!scoReliefTime) return null;
    return scoCandidates.find((p) => isOnScoAtTime(p, scoReliefTime)) ?? null;
  }, [scoCandidates, scoReliefTime]);

  const scoRelievers = useMemo(() => {
    if (!scoPerson) return [];
    return scoCandidates.filter((p) => p.id !== scoPerson.id);
  }, [scoCandidates, scoPerson]);

  /**
   * Première affectation SCO : personnes du créneau (même sans filtre horaire
   * strict) pour ne jamais se retrouver avec le message sans liste.
   */
  const scoInitialCandidates = !scoPerson && scoReliefTime
    ? (scoCandidates.length > 0 ? scoCandidates : scoSlotCandidates)
    : [];

  const scoReliever = scoRelievers.find((p) => String(p.id) === scoRelieverId) ?? null;
  const scoRelieverRegister = scoReliever && scoReliefTime
    ? numberedRegisterAtTime(scoReliever, scoReliefTime)
    : null;
  const scoNeedsFreeRegister = Boolean(scoReliever && scoReliefTime && scoRelieverRegister == null);

  const scoFreeRegisters = useMemo(() => {
    if (!scoPerson || !scoReliefTime || !scoNeedsFreeRegister) return [];
    return freeNumberedRegisters(
      plannings,
      scoDayKey,
      scoReliefTime,
      scoPerson.endTime,
      [scoPerson.id, scoReliever?.id].filter((id): id is number => id != null),
    );
  }, [scoPerson, scoReliefTime, scoNeedsFreeRegister, plannings, scoDayKey, scoReliever?.id]);

  function resetScoForm() {
    setScoReliefTime("");
    setScoTimeMenuOpen(false);
    setScoRelieverId("");
    setScoFreeRegister("");
  }

  function openScoPanel(dayIndex?: number, slotKey?: HalfDayKey) {
    setEditingCell(null);
    setError(null);
    if (dayIndex != null) setScoDayIndex(dayIndex);
    setScoRelieverId("");
    setScoFreeRegister("");
    setScoTimeMenuOpen(false);
    // Préremplit une heure du créneau cliqué (sinon vide).
    if (slotKey === "APRES_MIDI") setScoReliefTime("14:00");
    else if (slotKey === "MATIN") setScoReliefTime("07:45");
    else setScoReliefTime("");
    setScoOpen(true);
  }

  // Escape ferme la popup / le menu d'heures.
  useEffect(() => {
    if (!scoOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || scoPending) return;
      if (scoTimeMenuOpen) setScoTimeMenuOpen(false);
      else closeScoPanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoOpen, scoPending, scoTimeMenuOpen]);

  function closeScoPanel() {
    setScoOpen(false);
    resetScoForm();
    setScoPending(false);
  }

  async function submitScoRelief(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!scoReliefTime) {
      setError("Renseignez l'heure de relève.");
      return;
    }

    // Cas 1 : personne aux SCO → première affectation.
    if (!scoPerson) {
      const assignee = scoInitialCandidates.find((p) => String(p.id) === scoRelieverId) ?? null;
      if (!assignee) {
        setError("Choisissez qui prend les caisses automatiques.");
        return;
      }
      let payload;
      try {
        payload = buildReliefAssignment(assignee, scoReliefTime, SELF_CHECKOUT_REGISTER);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d'affecter les caisses automatiques.");
        return;
      }
      setScoPending(true);
      try {
        await api.patch<Planning>(`/api/plannings/${assignee.id}/register-number`, payload);
        closeScoPanel();
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Impossible d'affecter les caisses automatiques.");
      } finally {
        setScoPending(false);
      }
      return;
    }

    // Cas 2 : relève (échange ou caisse libre).
    if (!scoReliever) {
      setError("Choisissez la personne qui relève les caisses automatiques.");
      return;
    }
    if (scoReliefTime > scoPerson.endTime || scoReliefTime > scoReliever.endTime) {
      setError("L'heure de relève doit être couverte par les deux créneaux.");
      return;
    }
    if (scoReliefTime < scoReliever.startTime) {
      setError("Le relève n'est pas encore en service à cette heure.");
      return;
    }

    const targetRegister = scoRelieverRegister;
    let registerForFormerSco: number;
    if (targetRegister != null) {
      registerForFormerSco = targetRegister;
    } else {
      if (!scoFreeRegister) {
        setError("Choisissez une caisse libre pour la personne qui quitte les automatiques.");
        return;
      }
      registerForFormerSco = parseInt(scoFreeRegister, 10);
      if (!REGISTER_NUMBERS.includes(registerForFormerSco)) {
        setError("Caisse libre invalide.");
        return;
      }
    }

    let relieverPayload;
    let formerPayload;
    try {
      relieverPayload = buildReliefAssignment(scoReliever, scoReliefTime, SELF_CHECKOUT_REGISTER);
      formerPayload = buildReliefAssignment(scoPerson, scoReliefTime, registerForFormerSco);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de calculer la relève.");
      return;
    }

    // Contrôle conflit caisse pour l'ancien SCO après la relève.
    const formerIntervals: Interval[] =
      formerPayload.segments != null
        ? formerPayload.segments.map((seg, i) => ({
            start: seg.startTime,
            end: formerPayload.segments![i + 1]?.startTime ?? scoPerson.endTime,
            registerNumber: seg.registerNumber,
          }))
        : [{ start: scoPerson.startTime, end: scoPerson.endTime, registerNumber: formerPayload.registerNumber! }];

    const conflict = findRegisterConflict(
      scoPerson,
      formerIntervals.filter((iv) => iv.start >= scoReliefTime || iv.end > scoReliefTime),
      [scoReliever.id],
    );
    if (conflict) {
      setError(
        `La caisse ${conflict.registerNumber} est déjà attribuée à ${conflict.other.user.firstName} ${conflict.other.user.lastName} sur ce créneau.`,
      );
      return;
    }

    setScoPending(true);
    try {
      await api.patch<Planning>(`/api/plannings/${scoReliever.id}/register-number`, relieverPayload);
      await api.patch<Planning>(`/api/plannings/${scoPerson.id}/register-number`, formerPayload);
      closeScoPanel();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'appliquer la relève SCO.");
    } finally {
      setScoPending(false);
    }
  }

  function startEdit(entry: Planning, cellKey: string) {
    closeScoPanel();
    setEditingCell(cellKey);
    setError(null);
    // Affiche la caisse actuelle (ou le 1er segment d'une relève SCO).
    if (entry.registerNumber != null) {
      setFormRegisterNumber(String(entry.registerNumber));
    } else if (entry.registerSegments && entry.registerSegments.length > 0) {
      setFormRegisterNumber(String(entry.registerSegments[0].registerNumber));
    } else {
      setFormRegisterNumber("");
    }
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  /** Cherche un conflit de caisse numérotée avec un autre créneau du même jour. */
  function findRegisterConflict(
    entry: Planning,
    newIntervals: Interval[],
    excludeIds: number[] = [],
  ): { registerNumber: number; other: Planning } | null {
    const exclude = new Set([entry.id, ...excludeIds]);
    for (const p of plannings) {
      if (exclude.has(p.id) || p.workDate !== entry.workDate) continue;
      const otherIntervals = entryIntervals(p);
      for (const ni of newIntervals) {
        if (!REGISTER_NUMBERS.includes(ni.registerNumber)) continue; // caisses auto : pas de conflit
        for (const oi of otherIntervals) {
          if (oi.registerNumber === ni.registerNumber && intervalsOverlap(ni.start, ni.end, oi.start, oi.end)) {
            return { registerNumber: ni.registerNumber, other: p };
          }
        }
      }
    }
    return null;
  }

  async function submitSimple(e: FormEvent, entry: Planning, cellKey: string) {
    e.preventDefault();
    setError(null);

    const registerNumber = formRegisterNumber === "" ? null : parseInt(formRegisterNumber, 10);

    if (registerNumber !== null && REGISTER_NUMBERS.includes(registerNumber)) {
      const conflict = findRegisterConflict(entry, [{ start: entry.startTime, end: entry.endTime, registerNumber }]);
      if (conflict) {
        setError(
          `La caisse ${registerNumber} est déjà attribuée à ${conflict.other.user.firstName} ${conflict.other.user.lastName} sur ce créneau.`,
        );
        return;
      }
    }

    setPendingKey(cellKey);
    try {
      await api.patch<Planning>(`/api/plannings/${entry.id}/register-number`, { registerNumber });
      setEditingCell(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'attribuer cette affectation.");
    } finally {
      setPendingKey(null);
    }
  }

  async function clearRegister(entry: Planning, cellKey: string) {
    setError(null);
    setPendingKey(cellKey);
    try {
      await api.patch<Planning>(`/api/plannings/${entry.id}/register-number`, { registerNumber: null });
      setEditingCell(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de retirer cette affectation.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <>
    <div className="flex flex-col gap-6 print:hidden">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">Plan de caisse</h1>
          <p className="mt-1 text-base text-slate-700">
            Attribuez une caisse (1 à 8), les caisses automatiques ou une affectation &quot;Pauses / Retour&quot;
            aux créneaux déjà planifiés — caissiers, et LAD / Accueil lorsqu&apos;ils sont prévus en
            caisse. Les relèves SCO se gèrent via le bouton Caisse auto. Les horaires sont fixés
            par la direction ; seule l&apos;affectation se modifie ici. Au moins un(e) caissier(ère)
            doit superviser les caisses automatiques sur chaque créneau ouvert.
          </p>
        </div>
        <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />
      </div>

      {error && !scoOpen && <Alert>{error}</Alert>}

      <Card
        title="Affectations de la semaine"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.print()}
              disabled={loading || rowUsers.length === 0}
            >
              Imprimer
            </Button>
            <Button
              variant="primary"
              onClick={() => (scoOpen ? closeScoPanel() : openScoPanel())}
            >
              Caisse auto
            </Button>
          </div>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : rowUsers.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun(e) employé(e) à afficher pour cette semaine.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
            <p className="mb-3 text-sm font-medium text-slate-600 lg:hidden">
              Faites glisser horizontalement pour voir toute la semaine.
            </p>
            <table className="w-full min-w-[1140px] border-collapse text-sm">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-[160px] border-b border-r border-slate-200 bg-white p-2 text-left align-bottom text-sm font-semibold text-slate-700"
                  >
                    Employé(e)
                  </th>
                  {weekDays.map((day, idx) => (
                    <th
                      key={toISODate(day)}
                      colSpan={HALF_DAY_SLOTS.length}
                      className="border-b border-r border-slate-200 bg-slate-50 p-2 text-center font-semibold text-slate-600"
                    >
                      {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                    </th>
                  ))}
                </tr>
                <tr>
                  {weekDays.map((day, idx) =>
                    HALF_DAY_SLOTS.map((slot) => {
                      const dayKey = toISODate(day);
                      const closed = isClosedSlot(idx, slot.key);
                      const coverage = selfCheckoutCoverage.get(scoSlotKey(dayKey, slot.key));
                      const uncovered = !closed && coverage?.hasCaissier && !coverage.covered;
                      return (
                        <th
                          key={scoSlotKey(dayKey, slot.key)}
                          className={`min-w-[110px] border-b border-r border-slate-200 p-1.5 text-center font-medium ${
                            closed ? "bg-slate-100 text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {closed ? "Fermé" : slot.label}
                          {uncovered && (
                            <button
                              type="button"
                              title="Ouvrir la relève Caisse auto"
                              onClick={() => openScoPanel(idx, slot.key)}
                              className="mt-0.5 block w-full text-[10px] font-normal text-amber-600 underline decoration-amber-300 underline-offset-2 hover:text-amber-700"
                            >
                              ⚠ Auto non couvertes
                            </button>
                          )}
                        </th>
                      );
                    }),
                  )}
                </tr>
              </thead>
              <tbody>
                {rowUsers.map((user) => {
                  const origin = originRoleLabel(user);
                  return (
                  <tr key={user.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-2 text-left font-medium text-slate-700">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {user.firstName} {user.lastName}
                        </span>
                        {origin && (
                          <span className="text-[10px] font-normal text-slate-400">{origin}</span>
                        )}
                      </div>
                    </td>
                    {weekDays.map((day, idx) =>
                      HALF_DAY_SLOTS.map((slot) => {
                        const dayKey = toISODate(day);
                        const cellKey = `${user.id}_${dayKey}_${slot.key}`;
                        const closed = isClosedSlot(idx, slot.key);
                        const entry = planningByCell.get(cellKey);
                        const isPending = pendingKey === cellKey;
                        const isEditing = editingCell === cellKey;

                        if (closed) {
                          return (
                            <td
                              key={cellKey}
                              className="border-b border-r border-slate-200 bg-slate-100 p-1.5 text-center text-slate-300"
                            >
                              —
                            </td>
                          );
                        }

                        if (!entry) {
                          return (
                            <td
                              key={cellKey}
                              className="border-b border-r border-slate-200 p-1.5 text-center text-slate-300"
                              title="Non planifié(e) sur ce créneau"
                            >
                              —
                            </td>
                          );
                        }

                        const hasAssignment = entry.registerNumber != null || (entry.registerSegments && entry.registerSegments.length > 0);

                        return (
                          <td key={cellKey} className="border-b border-r border-slate-200 p-1">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50/60 p-1.5">
                                <form
                                  onSubmit={(e) => submitSimple(e, entry, cellKey)}
                                  className="flex flex-col gap-1"
                                >
                                  <select
                                    required
                                    autoFocus
                                    value={formRegisterNumber}
                                    onChange={(e) => setFormRegisterNumber(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-1 py-0.5 text-[11px]"
                                  >
                                    <option value="">Choisir...</option>
                                    <option value={String(SELF_CHECKOUT_REGISTER)}>Caisses automatiques</option>
                                    <option value={String(PAUSES_RETOUR_REGISTER)}>Pauses / Retour</option>
                                    {REGISTER_NUMBERS.map((n) => (
                                      <option key={n} value={String(n)}>
                                        Caisse {n}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex gap-1">
                                    <Button
                                      type="submit"
                                      disabled={isPending}
                                      className="w-full justify-center px-1 py-0.5 text-[10px]"
                                    >
                                      OK
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="w-full justify-center px-1 py-0.5 text-[10px]"
                                      onClick={cancelEdit}
                                    >
                                      Annuler
                                    </Button>
                                  </div>
                                </form>

                                {hasAssignment && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => clearRegister(entry, cellKey)}
                                    className="text-[10px] text-slate-400 underline hover:text-red-600 disabled:opacity-50"
                                  >
                                    Retirer l&apos;affectation
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                title={`Attribuer une affectation de caisse à ${user.firstName} ${user.lastName}`}
                                disabled={isPending}
                                onClick={() => startEdit(entry, cellKey)}
                                className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-md py-2 transition disabled:opacity-50 ${
                                  hasAssignment
                                    ? "bg-[var(--cf-blue)]/10 text-[var(--cf-blue)] hover:bg-[var(--cf-blue)]/20"
                                    : "border border-dashed border-slate-200 text-slate-400 hover:border-[var(--cf-blue)] hover:text-[var(--cf-blue)]"
                                }`}
                              >
                                {entry.registerSegments && entry.registerSegments.length > 0 ? (
                                  <>
                                    <span className="font-semibold">
                                      {entry.registerSegments.map((s) => registerShortLabel(s.registerNumber)).join(" → ")}
                                    </span>
                                    <span className="text-[10px] font-normal text-slate-400">
                                      bascule à {entry.registerSegments.slice(1).map((s) => formatFrenchTime(s.startTime)).join(", ")}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-semibold">
                                      {entry.registerNumber != null ? registerLabel(entry.registerNumber) : "+ Caisse"}
                                    </span>
                                    <span className="text-[10px] font-normal text-slate-400">
                                      {formatFrenchTime(entry.startTime)} - {formatFrenchTime(entry.endTime)}
                                    </span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {scoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10 sm:pt-16"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sco-modal-title"
          onClick={() => !scoPending && closeScoPanel()}
        >
          <form
            onSubmit={submitScoRelief}
            className="mb-16 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => {
              e.stopPropagation();
              if (scoTimeMenuOpen) setScoTimeMenuOpen(false);
            }}
          >
            <h2 id="sco-modal-title" className="text-lg font-semibold text-slate-800">
              Caisse auto — Relève
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Si personne n&apos;est encore aux automatiques, désignez qui les prend. Sinon,
              choisissez qui relève : échange de postes s&apos;il est en caisse, ou caisse libre
              s&apos;il entre en service.
            </p>

            {error && <div className="mt-3"><Alert>{error}</Alert></div>}

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
                Jour
                <select
                  value={String(scoDayIndex)}
                  onChange={(e) => {
                    setScoDayIndex(parseInt(e.target.value, 10));
                    setScoRelieverId("");
                    setScoFreeRegister("");
                    setError(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal"
                >
                  {weekDays.map((day, idx) => (
                    <option key={toISODate(day)} value={String(idx)}>
                      {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="relative flex min-w-[140px] flex-col gap-1 text-sm font-medium text-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <span>Heure de relève</span>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={scoTimeMenuOpen}
                  onClick={() => setScoTimeMenuOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-2.5 py-2 text-left text-sm font-normal text-slate-800"
                >
                  <span className={scoReliefTime ? "text-slate-800" : "text-slate-400"}>
                    {scoReliefTime ? formatFrenchTime(scoReliefTime) : "Choisir..."}
                  </span>
                  <span className="ml-2 text-slate-400" aria-hidden>▾</span>
                </button>
                {scoTimeMenuOpen && (
                  <ul
                    role="listbox"
                    className="absolute top-full left-0 z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    {SCO_RELIEF_TIMES.map((time) => (
                      <li key={time} role="option" aria-selected={scoReliefTime === time}>
                        <button
                          type="button"
                          className={`w-full px-2.5 py-1.5 text-left text-sm hover:bg-slate-100 ${
                            scoReliefTime === time ? "bg-slate-50 font-medium text-[var(--cf-blue)]" : "text-slate-800"
                          }`}
                          onClick={() => {
                            setScoReliefTime(time);
                            setScoRelieverId("");
                            setScoFreeRegister("");
                            setScoTimeMenuOpen(false);
                            setError(null);
                          }}
                        >
                          {formatFrenchTime(time)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Champ requis invisible pour la validation HTML du formulaire. */}
                <input type="hidden" required value={scoReliefTime} onChange={() => {}} />
              </div>
            </div>

            <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {!scoReliefTime ? (
                <span className="text-slate-400">Indiquez l&apos;heure pour voir qui est aux SCO.</span>
              ) : scoPerson ? (
                <span>
                  Aux SCO :{" "}
                  <strong>
                    {scoPerson.user.firstName} {scoPerson.user.lastName}
                  </strong>
                </span>
              ) : scoInitialCandidates.length > 0 ? (
                <span>Aucune couverture SCO — choisissez qui prend les automatiques.</span>
              ) : (
                <span className="text-amber-700">Personne n&apos;est planifié(e) sur ce créneau.</span>
              )}
            </div>

            {scoReliefTime && !scoPerson && scoInitialCandidates.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Qui prend les automatiques ?
                  <select
                    required
                    value={scoRelieverId}
                    onChange={(e) => {
                      setScoRelieverId(e.target.value);
                      setError(null);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal"
                  >
                    <option value="">Choisir...</option>
                    {scoInitialCandidates.map((p) => {
                      const origin = originRoleLabel(p.user);
                      const reg = registerLabelAtTime(p, scoReliefTime);
                      return (
                        <option key={p.id} value={String(p.id)}>
                          {p.user.firstName} {p.user.lastName}
                          {origin ? ` (${origin})` : ""} · {reg}
                          {" · "}
                          {formatFrenchTime(p.startTime)}–{formatFrenchTime(p.endTime)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            )}

            {scoPerson && (
              <div className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Relève
                  <select
                    required
                    value={scoRelieverId}
                    onChange={(e) => {
                      setScoRelieverId(e.target.value);
                      setScoFreeRegister("");
                      setError(null);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal"
                  >
                    <option value="">Choisir...</option>
                    {scoRelievers.map((p) => {
                      const origin = originRoleLabel(p.user);
                      const reg = registerLabelAtTime(p, scoReliefTime);
                      return (
                        <option key={p.id} value={String(p.id)}>
                          {p.user.firstName} {p.user.lastName}
                          {origin ? ` (${origin})` : ""} · {reg}
                          {" · dès "}
                          {formatFrenchTime(p.startTime)}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {scoReliever && scoRelieverRegister != null && (
                  <p className="text-sm text-slate-600">
                    Échange : {scoReliever.user.firstName} → Auto,{" "}
                    {scoPerson.user.firstName} → {registerShortLabel(scoRelieverRegister)}
                  </p>
                )}

                {scoNeedsFreeRegister && (
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Caisse pour {scoPerson.user.firstName} (après la relève)
                    <select
                      required
                      value={scoFreeRegister}
                      onChange={(e) => {
                        setScoFreeRegister(e.target.value);
                        setError(null);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal"
                    >
                      <option value="">Choisir une caisse libre...</option>
                      {scoFreeRegisters.map((n) => (
                        <option key={n} value={String(n)}>
                          Caisse {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {scoNeedsFreeRegister && scoFreeRegisters.length === 0 && (
                  <p className="text-sm text-amber-700">
                    Aucune caisse libre sur ce créneau pour accueillir {scoPerson.user.firstName}.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={scoPending}
                onClick={closeScoPanel}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  scoPending
                  || !scoReliefTime
                  || !scoRelieverId
                  || (Boolean(scoPerson) && scoNeedsFreeRegister && scoFreeRegisters.length === 0)
                  || (!scoPerson && scoInitialCandidates.length === 0)
                }
              >
                {scoPending
                  ? "Enregistrement…"
                  : scoPerson
                    ? "Valider la relève"
                    : "Mettre aux SCO"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>

    <PrintablePlanDeCaisse
      weekDays={weekDays}
      weekStart={weekStart}
      rowUsers={rowUsers}
      planningByCell={planningByCell}
      ladOnDutyBySlot={ladOnDutyBySlot}
      siteName={rowUsers.find((u) => u.site?.name)?.site?.name ?? null}
    />
    </>
  );
}

type PrintTeamRow = { user: User; entry: Planning };

const MANUAL_NOTE_KINDS = [
  { key: "absence", label: "Absence" },
  { key: "retard", label: "Retard" },
  { key: "supp", label: "Temps supplémentaire" },
] as const;

/** Deux lignes manuscrites (Absence / Retard / Temps supplémentaire) en tête de page. */
function PrintManualNotes() {
  return (
    <div className="print-plan-caisse__notes" aria-label="Annotations manuscrites">
      <table>
        <thead>
          <tr>
            {MANUAL_NOTE_KINDS.map((kind) => (
              <th key={kind.key} colSpan={2}>
                {kind.label}
              </th>
            ))}
          </tr>
          <tr>
            {MANUAL_NOTE_KINDS.map((kind) => (
              <Fragment key={kind.key}>
                <th className="print-plan-caisse__notes-sub">Nom</th>
                <th className="print-plan-caisse__notes-sub">Temps</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1].map((row) => (
            <tr key={row}>
              {MANUAL_NOTE_KINDS.map((kind) => (
                <Fragment key={kind.key}>
                  <td className="print-plan-caisse__notes-name" aria-label={`${kind.label} — nom`} />
                  <td className="print-plan-caisse__notes-time" aria-label={`${kind.label} — temps`} />
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrintablePlanDeCaisse({
  weekDays,
  weekStart,
  rowUsers,
  planningByCell,
  ladOnDutyBySlot,
  siteName,
}: {
  weekDays: Date[];
  weekStart: Date;
  rowUsers: User[];
  planningByCell: Map<string, Planning>;
  ladOnDutyBySlot: Map<string, Planning[]>;
  siteName: string | null;
}) {
  const weekNum = isoWeekNumber(weekStart);

  function teamForSlot(dayIndex: number, slotKey: HalfDayKey): PrintTeamRow[] {
    if (isClosedSlot(dayIndex, slotKey)) return [];
    const dayKey = toISODate(weekDays[dayIndex]);
    const rows: PrintTeamRow[] = [];
    for (const user of rowUsers) {
      const entry = planningByCell.get(`${user.id}_${dayKey}_${slotKey}`);
      if (!entry) continue;
      rows.push({ user, entry });
    }
    rows.sort((a, b) => {
      if (a.entry.startTime !== b.entry.startTime) {
        return a.entry.startTime < b.entry.startTime ? -1 : 1;
      }
      return compareUsersByName(a.user, b.user);
    });
    return rows;
  }

  function ladForSlot(dayIndex: number, slotKey: HalfDayKey): Planning[] {
    if (isClosedSlot(dayIndex, slotKey)) return [];
    const dayKey = toISODate(weekDays[dayIndex]);
    return ladOnDutyBySlot.get(`${dayKey}_${slotKey}`) ?? [];
  }

  return (
    <div className="print-plan-caisse hidden print:block">
      {weekDays.map((day, dayIndex) => {
        const morning = teamForSlot(dayIndex, "MATIN");
        const evening = teamForSlot(dayIndex, "APRES_MIDI");
        const eveningClosed = isClosedSlot(dayIndex, "APRES_MIDI");
        const morningLad = ladForSlot(dayIndex, "MATIN");
        const eveningLad = ladForSlot(dayIndex, "APRES_MIDI");

        return (
          <section
            key={toISODate(day)}
            className="print-plan-caisse__page"
          >
            <header className="print-plan-caisse__header">
              <div className="print-plan-caisse__brand">
                {/* eslint-disable-next-line @next/next/no-img-element -- img classique plus fiable à l'impression */}
                <img
                  src="/carrefour-logo.png"
                  alt="Carrefour"
                  className="print-plan-caisse__logo"
                  width={28}
                  height={28}
                />
                <span>Plan de caisse</span>
              </div>
              <p className="print-plan-caisse__date">
                {DAY_LABELS[dayIndex]}{" "}
                {day.toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="print-plan-caisse__meta">
                Semaine {weekNum}
                {siteName ? ` · ${siteName}` : ""}
              </p>
            </header>

            <PrintManualNotes />

            <div className="print-plan-caisse__teams">
              <PrintTeamPanel title="Équipe du matin" rows={morning} ladOnDuty={morningLad} />
              <PrintTeamPanel
                title="Équipe de l'après-midi"
                rows={evening}
                closed={eveningClosed}
                ladOnDuty={eveningLad}
              />
            </div>

            <p className="print-plan-caisse__legend">
              <strong>SCO</strong> = caisses automatiques · <strong>P/R</strong> = pauses / retour ·{" "}
              Pause = 3 min / heure travaillée · Fin de pause à compléter à la main
            </p>
          </section>
        );
      })}
    </div>
  );
}

function PrintTeamPanel({
  title,
  rows,
  closed = false,
  ladOnDuty = [],
}: {
  title: string;
  rows: PrintTeamRow[];
  closed?: boolean;
  ladOnDuty?: Planning[];
}) {
  const ladRows =
    ladOnDuty.length > 0
      ? ladOnDuty
      : [null];

  return (
    <div className="print-plan-caisse__team">
      <h2>{title}</h2>
      {closed ? (
        <p className="print-plan-caisse__empty">Fermé</p>
      ) : rows.length === 0 ? (
        <p className="print-plan-caisse__empty">Aucun agent prévu</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>N°</th>
              <th>Arrivée</th>
              <th>Fin</th>
              <th>Caisses</th>
              <th>Bascules</th>
              <th>Début pause</th>
              <th>Fin pause</th>
              <th>Temps pause</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, entry }) => {
              const origin = originRoleLabel(user);
              const workMin = durationMinutes(entry.startTime, entry.endTime);
              const pauseMin = pauseMinutesForWork(workMin);
              return (
                <tr key={user.id}>
                  <td className="print-plan-caisse__name">
                    {user.firstName} {user.lastName}
                    {origin ? ` (${origin})` : ""}
                  </td>
                  <td className="print-plan-caisse__num">{user.cashierNumber ?? "—"}</td>
                  <td>{formatFrenchTime(entry.startTime)}</td>
                  <td>{formatFrenchTime(entry.endTime)}</td>
                  <td className="print-plan-caisse__reg">{printRegisters(entry)}</td>
                  <td>{printBasculeTimes(entry)}</td>
                  <td className="print-plan-caisse__write" aria-label="Début de pause à écrire">
                    {"\u00a0"}
                  </td>
                  <td className="print-plan-caisse__write" aria-label="Fin de pause à écrire">
                    {"\u00a0"}
                  </td>
                  <td className="print-plan-caisse__pause">{pauseMin} min</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!closed && (
        <div className="print-plan-caisse__lad">
          <p className="print-plan-caisse__lad-title">LAD</p>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Arrivée</th>
                <th>Fin</th>
                <th>Début pause</th>
                <th>Fin pause</th>
                <th>Temps pause</th>
              </tr>
            </thead>
            <tbody>
              {ladRows.map((entry, idx) => {
                const pauseMin = entry
                  ? pauseMinutesForWork(durationMinutes(entry.startTime, entry.endTime))
                  : null;
                return (
                  <tr key={entry?.id ?? `lad-blank-${idx}`}>
                    <td className="print-plan-caisse__lad-name">
                      {entry ? (
                        `${entry.user.firstName} ${entry.user.lastName}`
                      ) : (
                        "\u00a0"
                      )}
                    </td>
                    <td>
                      {entry ? formatFrenchTime(entry.startTime) : "\u00a0"}
                    </td>
                    <td>
                      {entry ? formatFrenchTime(entry.endTime) : "\u00a0"}
                    </td>
                    <td className="print-plan-caisse__write" aria-label="Début de pause LAD à écrire">
                      {"\u00a0"}
                    </td>
                    <td className="print-plan-caisse__write" aria-label="Fin de pause LAD à écrire">
                      {"\u00a0"}
                    </td>
                    <td className="print-plan-caisse__pause">
                      {pauseMin !== null ? `${pauseMin} min` : "\u00a0"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
