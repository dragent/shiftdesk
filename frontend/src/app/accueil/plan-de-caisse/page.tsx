"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Button, Alert, TimeField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import {
  DAY_LABELS,
  formatFrenchTime,
  HALF_DAY_SLOTS,
  isClosedSlot,
  MAX_SPLIT_SEGMENTS,
  PAUSES_RETOUR_REGISTER,
  REGISTER_NUMBERS,
  registerLabel,
  registerShortLabel,
  SELF_CHECKOUT_REGISTER,
  slotKeyForTime,
  SPLIT_REGISTER_NUMBERS,
} from "@/lib/planning";
import type { Planning, User } from "@/lib/types";

type FormMode = "simple" | "split";

interface Interval {
  start: string;
  end: string;
  registerNumber: number;
}

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

/** Options de caisse utilisables pour un segment de bascule (pas "Pauses / Retour"). */
function SplitRegisterOptions() {
  return (
    <>
      <option value="">Choisir...</option>
      {SPLIT_REGISTER_NUMBERS.map((n) => (
        <option key={n} value={String(n)}>
          {registerLabel(n)}
        </option>
      ))}
    </>
  );
}

/**
 * Décompose un créneau (simple ou en bascule) en intervalles horaires avec
 * numéro de caisse, uniquement pour les caisses numérotées et automatiques
 * (utilisé pour la détection de conflit et la couverture des caisses auto).
 * "Pauses / Retour" n'apparaît jamais dans ces intervalles.
 */
function entryIntervals(p: Planning): Interval[] {
  if (p.registerSegments && p.registerSegments.length > 0) {
    return p.registerSegments.map((seg, i) => ({
      start: seg.startTime,
      end: p.registerSegments![i + 1]?.startTime ?? p.endTime,
      registerNumber: seg.registerNumber,
    }));
  }
  if (p.registerNumber != null && p.registerNumber >= 0) {
    return [{ start: p.startTime, end: p.endTime, registerNumber: p.registerNumber }];
  }
  return [];
}

function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
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
  const [caissiers, setCaissiers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Case en cours d'édition (attribution d'une affectation de caisse à un
  // créneau déjà planifié).
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("simple");
  const [formRegisterNumber, setFormRegisterNumber] = useState("");
  const [formSegmentRegisters, setFormSegmentRegisters] = useState<string[]>(["", ""]);
  const [formSwitchTimes, setFormSwitchTimes] = useState<string[]>([""]);

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
      const [planningData, caissiersData] = await Promise.all([
        api.get<Planning[]>(`/api/plannings?from=${from}&to=${to}&caissiersOnly=1`),
        api.get<User[]>("/api/caissiers"),
      ]);
      setPlannings(planningData);
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

  function startEdit(entry: Planning, cellKey: string) {
    setEditingCell(cellKey);
    setError(null);
    if (entry.registerSegments && entry.registerSegments.length > 0) {
      setFormMode("split");
      setFormSegmentRegisters(entry.registerSegments.map((s) => String(s.registerNumber)));
      setFormSwitchTimes(entry.registerSegments.slice(1).map((s) => s.startTime));
    } else {
      setFormMode("simple");
      setFormRegisterNumber(entry.registerNumber != null ? String(entry.registerNumber) : "");
      setFormSegmentRegisters(["", ""]);
      setFormSwitchTimes([""]);
    }
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  function switchToMode(mode: FormMode, entry: Planning) {
    setFormMode(mode);
    setError(null);
    if (mode === "split" && formSegmentRegisters.every((v) => v === "")) {
      // Première bascule vers ce mode : pré-remplit le premier segment avec
      // l'affectation simple actuelle si c'était une caisse (pas pauses/retour).
      const first = formRegisterNumber !== "" && parseInt(formRegisterNumber, 10) >= 0 ? formRegisterNumber : "";
      setFormSegmentRegisters([first, ""]);
      setFormSwitchTimes([""]);
    }
    void entry;
  }

  function addSwitch(entry: Planning) {
    if (formSegmentRegisters.length >= MAX_SPLIT_SEGMENTS) return;
    const lastSwitch = formSwitchTimes[formSwitchTimes.length - 1] || entry.startTime;
    setFormSwitchTimes((prev) => [...prev, lastSwitch]);
    setFormSegmentRegisters((prev) => [...prev, ""]);
  }

  function removeSwitch() {
    if (formSegmentRegisters.length <= 2) return;
    setFormSwitchTimes((prev) => prev.slice(0, -1));
    setFormSegmentRegisters((prev) => prev.slice(0, -1));
  }

  /** Cherche un conflit de caisse numérotée avec un autre créneau du même jour. */
  function findRegisterConflict(entry: Planning, newIntervals: Interval[]): { registerNumber: number; other: Planning } | null {
    for (const p of plannings) {
      if (p.id === entry.id || p.workDate !== entry.workDate) continue;
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

  async function submitSplit(e: FormEvent, entry: Planning, cellKey: string) {
    e.preventDefault();
    setError(null);

    if (formSegmentRegisters.some((v) => v === "")) {
      setError("Choisissez une caisse pour chaque tranche de la bascule.");
      return;
    }
    if (formSwitchTimes.some((v) => v === "")) {
      setError("Renseignez l'heure de chaque bascule.");
      return;
    }
    const times = [entry.startTime, ...formSwitchTimes];
    for (let i = 1; i < times.length; i++) {
      if (times[i] <= times[i - 1]) {
        setError("Les heures de bascule doivent être strictement croissantes.");
        return;
      }
    }
    if (formSwitchTimes[formSwitchTimes.length - 1] >= entry.endTime) {
      setError("Une heure de bascule doit être avant la fin du créneau.");
      return;
    }

    const segments = [entry.startTime, ...formSwitchTimes].map((startTime, i) => ({
      startTime,
      registerNumber: parseInt(formSegmentRegisters[i], 10),
    }));

    const newIntervals: Interval[] = segments.map((seg, i) => ({
      start: seg.startTime,
      end: segments[i + 1]?.startTime ?? entry.endTime,
      registerNumber: seg.registerNumber,
    }));
    const conflict = findRegisterConflict(entry, newIntervals);
    if (conflict) {
      setError(
        `La caisse ${conflict.registerNumber} est déjà attribuée à ${conflict.other.user.firstName} ${conflict.other.user.lastName} sur une partie de ce créneau.`,
      );
      return;
    }

    setPendingKey(cellKey);
    try {
      await api.patch<Planning>(`/api/plannings/${entry.id}/register-number`, { segments });
      setEditingCell(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'attribuer cette bascule.");
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Plan de caisse</h1>
          <p className="text-sm text-slate-500">
            Attribuez une caisse (1 à 8), les caisses automatiques ou une affectation &quot;Pauses / Retour&quot;
            aux créneaux déjà planifiés pour chaque caissier(ère) — avec, si besoin, une bascule en
            cours de créneau (ex. caisse puis caisses automatiques à une heure donnée). Les horaires
            sont fixés par la direction dans le planning ; seule l&apos;affectation se modifie ici. Au
            moins un(e) caissier(ère) doit superviser les caisses automatiques sur chaque créneau ouvert.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <Card title={`Semaine du ${weekDays[0].toLocaleDateString("fr-FR")} au ${weekDays[6].toLocaleDateString("fr-FR")}`}>
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : caissiers.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun caissier(ère) enregistré(e).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px] border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-[160px] border-b border-r border-slate-200 bg-white p-2 text-left align-bottom text-sm font-semibold text-slate-700"
                  >
                    Caissier(ère)
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
                      const closed = isClosedSlot(idx, slot.key);
                      const coverage = selfCheckoutCoverage.get(`${toISODate(day)}_${slot.key}`);
                      const uncovered = !closed && coverage?.hasCaissier && !coverage.covered;
                      return (
                        <th
                          key={`${toISODate(day)}_${slot.key}`}
                          className={`min-w-[110px] border-b border-r border-slate-200 p-1.5 text-center font-medium ${
                            closed ? "bg-slate-100 text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {closed ? "Fermé" : slot.label}
                          {uncovered && (
                            <div
                              title="Aucun(e) caissier(ère) n'est affecté(e) aux caisses automatiques sur ce créneau."
                              className="mt-0.5 text-[10px] font-normal text-amber-600"
                            >
                              ⚠ Auto non couvertes
                            </div>
                          )}
                        </th>
                      );
                    }),
                  )}
                </tr>
              </thead>
              <tbody>
                {caissiers.map((user) => (
                  <tr key={user.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-2 text-left font-medium text-slate-700">
                      {user.firstName} {user.lastName}
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
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => switchToMode("simple", entry)}
                                    className={`flex-1 rounded-md px-1 py-0.5 text-[10px] font-medium transition ${
                                      formMode === "simple"
                                        ? "bg-[var(--cf-blue)] text-white"
                                        : "bg-white text-slate-500 hover:bg-slate-100"
                                    }`}
                                  >
                                    Simple
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => switchToMode("split", entry)}
                                    className={`flex-1 rounded-md px-1 py-0.5 text-[10px] font-medium transition ${
                                      formMode === "split"
                                        ? "bg-[var(--cf-blue)] text-white"
                                        : "bg-white text-slate-500 hover:bg-slate-100"
                                    }`}
                                  >
                                    Bascule
                                  </button>
                                </div>

                                {formMode === "simple" ? (
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
                                ) : (
                                  <form
                                    onSubmit={(e) => submitSplit(e, entry, cellKey)}
                                    className="flex flex-col gap-1"
                                  >
                                    <div className="text-[10px] text-slate-500">Dès {formatFrenchTime(entry.startTime)}</div>
                                    <select
                                      required
                                      autoFocus
                                      value={formSegmentRegisters[0]}
                                      onChange={(e) =>
                                        setFormSegmentRegisters((prev) => {
                                          const next = [...prev];
                                          next[0] = e.target.value;
                                          return next;
                                        })
                                      }
                                      className="w-full rounded-md border border-slate-300 px-1 py-0.5 text-[11px]"
                                    >
                                      <SplitRegisterOptions />
                                    </select>

                                    {formSwitchTimes.map((switchTime, i) => (
                                      <div key={i} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-slate-500">Bascule à</span>
                                          <TimeField
                                            required
                                            min={entry.startTime}
                                            max={entry.endTime}
                                            value={switchTime}
                                            onChange={(v) =>
                                              setFormSwitchTimes((prev) => {
                                                const next = [...prev];
                                                next[i] = v;
                                                return next;
                                              })
                                            }
                                            className="flex-1 rounded-md border border-slate-300 px-1 py-0.5 text-[11px]"
                                          />
                                        </div>
                                        <select
                                          required
                                          value={formSegmentRegisters[i + 1]}
                                          onChange={(e) =>
                                            setFormSegmentRegisters((prev) => {
                                              const next = [...prev];
                                              next[i + 1] = e.target.value;
                                              return next;
                                            })
                                          }
                                          className="w-full rounded-md border border-slate-300 px-1 py-0.5 text-[11px]"
                                        >
                                          <SplitRegisterOptions />
                                        </select>
                                      </div>
                                    ))}

                                    <div className="flex gap-1">
                                      {formSegmentRegisters.length < MAX_SPLIT_SEGMENTS && (
                                        <button
                                          type="button"
                                          onClick={() => addSwitch(entry)}
                                          className="flex-1 text-[10px] text-[var(--cf-blue)] underline"
                                        >
                                          + Bascule
                                        </button>
                                      )}
                                      {formSegmentRegisters.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={removeSwitch}
                                          className="flex-1 text-[10px] text-slate-400 underline"
                                        >
                                          − Retirer
                                        </button>
                                      )}
                                    </div>

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
                                )}

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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
