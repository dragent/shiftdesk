"use client";

import { useCallback, useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Alert, WeekNavigator } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { api, ApiError } from "@/lib/api";
import { DAY_LABELS, durationMinutes, formatFrenchTime, formatMinutesAsHours, slotLabel } from "@/lib/planning";
import { useEffectLoad } from "@/lib/useEffectLoad";
import type { Planning } from "@/lib/types";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date): string {
  // Formatted in local time (not toISOString(), which converts to UTC and
  // would shift the date by one day depending on the time zone).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function MonPlanningPage() {
  return (
    <RoleGuard roles={["ROLE_HOTE", "ROLE_CAISSIER", "ROLE_LAD", "ROLE_RAYON", "ROLE_SECURITE", "ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <MonPlanningContent />
      </AppShell>
    </RoleGuard>
  );
}

function MonPlanningContent() {
  const { user, hasRole } = useAuth();
  const isDirectionOrAdmin = hasRole("ROLE_DIRECTION", "ROLE_ADMIN");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const data = await api.get<Planning[]>(`/api/plannings?from=${from}&to=${to}&mine=1`);
      setPlannings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffectLoad(load);

  const planningsByDay = useMemo(() => {
    const map = new Map<string, Planning[]>();
    for (const p of plannings) {
      const key = p.workDate;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    for (const dayPlannings of map.values()) {
      dayPlannings.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [plannings]);

  // Total scheduled hours for the week (all half-days combined), displayed
  // next to the contract hours, using the same colour code as the management
  // grid (green if <= contract hours, red otherwise).
  const totalMinutes = useMemo(
    () => plannings.reduce((sum, p) => sum + durationMinutes(p.startTime, p.endTime), 0),
    [plannings],
  );
  const contractMinutes = user?.contractMinutes ?? 0;
  const totalColorClass =
    contractMinutes > 0
      ? totalMinutes > contractMinutes
        ? "bg-red-100 text-red-700"
        : "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-500";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">Mon planning</h1>
          <p className="mt-1 text-base text-slate-700">
            Consultez vos créneaux de travail pour la semaine. Seule la direction peut créer ou
            modifier le planning.
          </p>
        </div>
        <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="Créneaux de la semaine">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : isDirectionOrAdmin ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {weekDays.map((day, idx) => {
              const key = toISODate(day);
              const dayPlannings = planningsByDay.get(key) ?? [];
              return (
                <div key={key} className="rounded-md border border-slate-200 p-2">
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {dayPlannings.length === 0 && (
                      <p className="text-xs text-slate-400">Aucun créneau</p>
                    )}
                    {dayPlannings.map((p) => (
                      <div key={p.id} className="rounded-md bg-slate-50 p-2 text-xs">
                        <p className="font-medium text-slate-700">{slotLabel(p.startTime)}</p>
                        <p className="text-slate-500">
                          {formatFrenchTime(p.startTime)} - {formatFrenchTime(p.endTime)}
                        </p>
                        {p.site && <p className="text-slate-500">{p.site.name}</p>}
                        {p.note && <p className="text-slate-500">{p.note}</p>}
                        <Badge tone={p.status}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* Mobile (< sm): contract/total summary on top, then one
                full-width row per day — more readable than a cramped grid
                on a small screen. */}
            <div className="flex flex-col gap-3 sm:hidden">
              {(contractMinutes > 0 || totalMinutes > 0) && (
                <div className="flex items-stretch gap-2">
                  {contractMinutes > 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-md bg-slate-100 px-3 py-2 text-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Contrat
                      </span>
                      <span className="text-sm font-semibold text-slate-600">
                        {formatMinutesAsHours(contractMinutes)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex flex-1 flex-col items-center justify-center rounded-md px-3 py-2 text-center ${totalColorClass}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
                      Total
                    </span>
                    <span className="text-sm font-semibold">{formatMinutesAsHours(totalMinutes)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200">
                {weekDays.map((day, idx) => {
                  const key = toISODate(day);
                  const dayPlannings = planningsByDay.get(key) ?? [];
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="shrink-0 text-sm font-medium text-slate-600">
                        {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                      </span>
                      {dayPlannings.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          {dayPlannings.map((p) => (
                            <span key={p.id} className="text-sm font-medium text-slate-700">
                              {formatFrenchTime(p.startTime)} - {formatFrenchTime(p.endTime)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* sm and above: a single row for the whole week, following the
                same principle as the management grid (contract hours on the
                left, days in the middle, total on the right with the same
                green/red colour code relative to the contract hours). */}
            <div className="hidden items-stretch gap-2 overflow-x-auto sm:flex">
              {contractMinutes > 0 && (
                <div className="flex shrink-0 flex-col items-center justify-center rounded-md bg-slate-100 px-3 py-2 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Contrat
                  </span>
                  <span className="text-sm font-semibold text-slate-600">
                    {formatMinutesAsHours(contractMinutes)}
                  </span>
                </div>
              )}
              {weekDays.map((day, idx) => {
                const key = toISODate(day);
                const dayPlannings = planningsByDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className="flex min-w-[110px] flex-1 flex-col overflow-hidden rounded-md border border-slate-200 text-center"
                  >
                    {/* The day acts as a clearly distinct header above the hours. */}
                    <p className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                      {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                    </p>
                    {dayPlannings.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-slate-400">—</p>
                    ) : (
                      // One row per slot (morning / afternoon), separated by a
                      // simple rule rather than merged into a single line.
                      <div className="flex flex-1 flex-col divide-y divide-slate-200">
                        {dayPlannings.map((p) => (
                          <p key={p.id} className="px-2 py-1.5 text-xs font-medium text-slate-700">
                            {formatFrenchTime(p.startTime)} - {formatFrenchTime(p.endTime)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                className={`flex shrink-0 flex-col items-center justify-center rounded-md px-3 py-2 text-center ${totalColorClass}`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
                  Total
                </span>
                <span className="text-sm font-semibold">{formatMinutesAsHours(totalMinutes)}</span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
