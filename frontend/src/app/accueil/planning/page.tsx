"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { api, ApiError } from "@/lib/api";
import { DAY_LABELS, durationMinutes, formatFrenchTime, formatMinutesAsHours, slotLabel } from "@/lib/planning";
import type { Planning } from "@/lib/types";

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

export default function MonPlanningPage() {
  return (
    <RoleGuard roles={["ROLE_HOTE", "ROLE_CAISSIER", "ROLE_RAYON", "ROLE_SECURITE", "ROLE_DIRECTION", "ROLE_ADMIN"]}>
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

  useEffect(() => {
    load();
  }, [load]);

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

  // Total d'heures planifiées sur la semaine (toutes demi-journées
  // confondues), pour l'affichage à côté du contrat, avec le même code
  // couleur que la grille de la direction (vert si <= contrat, rouge sinon).
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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">Mon planning</h1>
          <p className="mt-1 text-base text-slate-700">
            Consultez vos créneaux de travail pour la semaine. Seule la direction peut créer ou
            modifier le planning.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
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
            className="w-full sm:w-auto"
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
            {/* Mobile (< sm) : résumé contrat/total en tête, puis une ligne
                pleine largeur par jour — plus lisible qu'une grille serrée
                sur un petit écran. */}
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

            {/* sm et plus : une seule ligne pour toute la semaine, sur le
                même principe que la grille de la direction (contrat à
                gauche, jours au centre, total à droite avec le même code
                couleur vert/rouge selon le contrat). */}
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
                    {/* Le jour est un en-tête bien distinct, au-dessus des heures. */}
                    <p className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                      {DAY_LABELS[idx]} {day.getDate()}/{day.getMonth() + 1}
                    </p>
                    {dayPlannings.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-slate-400">—</p>
                    ) : (
                      // Une ligne par créneau (matin / après-midi), séparées par
                      // un simple trait plutôt qu'assemblées sur une seule ligne.
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
