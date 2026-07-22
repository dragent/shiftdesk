"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Planning, User } from "@/lib/types";

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

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [userId, setUserId] = useState<number | "">("");
  const [workDate, setWorkDate] = useState(toISODate(new Date()));
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [note, setNote] = useState("");

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
    try {
      const from = toISODate(weekStart);
      const to = toISODate(weekDays[6]);
      const [planningData, usersData] = await Promise.all([
        api.get<Planning[]>(`/api/plannings?from=${from}&to=${to}`),
        api.get<User[]>("/api/users"),
      ]);
      setPlannings(planningData);
      const hotes = usersData.filter((u) => u.roles?.includes("ROLE_HOTE"));
      setUsers(hotes.length > 0 ? hotes : usersData);
      if (hotes.length > 0 && !userId) setUserId(hotes[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekDays, userId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post<Planning>("/api/plannings", {
        userId,
        workDate,
        startTime,
        endTime,
        note: note || null,
      });
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer le créneau.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removePlanning(id: number) {
    try {
      await api.delete(`/api/plannings/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer le créneau.");
    }
  }

  const planningsByDay = useMemo(() => {
    const map = new Map<string, Planning[]>();
    for (const p of plannings) {
      const key = p.workDate;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [plannings]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Planning</h1>
          <p className="text-sm text-slate-500">
            Créez et gérez les créneaux de travail des hôtes/hôtesses d&apos;accueil.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <Card title="Ajouter un créneau">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Hôte(sse)</label>
            <select
              required
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              required
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Début</label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fin</label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optionnel)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={submitting} className="w-full justify-center">
              Ajouter
            </Button>
          </div>
        </form>
      </Card>

      <Card title={`Semaine du ${weekDays[0].toLocaleDateString("fr-FR")} au ${weekDays[6].toLocaleDateString("fr-FR")}`}>
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
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
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {p.user.firstName} {p.user.lastName}
                          </span>
                          <button
                            onClick={() => removePlanning(p.id)}
                            className="text-slate-400 hover:text-red-600"
                            title="Supprimer"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-slate-500">
                          {p.startTime} - {p.endTime}
                        </p>
                        <Badge tone={p.status}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
