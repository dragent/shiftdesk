"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatFrenchTimeOfDate } from "@/lib/planning";
import type { Pause, PauseType, User } from "@/lib/types";

const PAUSE_TYPES: { value: PauseType; label: string }[] = [
  { value: "COURTE", label: "Pause courte" },
  { value: "DEJEUNER", label: "Pause déjeuner" },
  { value: "AUTRE", label: "Autre" },
];

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isToday(isoDate: string): boolean {
  return isoDate === toISODate(new Date());
}

export default function PausesPage() {
  return (
    <RoleGuard roles={["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <PausesContent />
      </AppShell>
    </RoleGuard>
  );
}

function PausesContent() {
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [pauses, setPauses] = useState<Pause[]>([]);
  const [caissiers, setCaissiers] = useState<User[]>([]);
  const [selectedCaissierId, setSelectedCaissierId] = useState<number | "">("");
  const [type, setType] = useState<PauseType>("COURTE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dayPauses, caissiersData] = await Promise.all([
        api.get<Pause[]>(`/api/pauses?date=${selectedDate}`),
        api.get<User[]>("/api/caissiers"),
      ]);
      setPauses(dayPauses);
      setCaissiers(caissiersData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  const caissiersEnPause = useMemo(
    () => new Set(pauses.filter((p) => p.status === "EN_COURS").map((p) => p.user.id)),
    [pauses],
  );

  const caissiersDisponibles = useMemo(
    () => caissiers.filter((c) => c.active && !caissiersEnPause.has(c.id)),
    [caissiers, caissiersEnPause],
  );

  useEffect(() => {
    if (selectedCaissierId === "" && caissiersDisponibles.length > 0) {
      setSelectedCaissierId(caissiersDisponibles[0].id);
    }
  }, [caissiersDisponibles, selectedCaissierId]);

  async function startPause() {
    if (!selectedCaissierId) {
      setError("Sélectionnez un caissier.");
      return;
    }
    setError(null);
    setActionLoading(true);
    try {
      await api.post<Pause>("/api/pauses/start", { caissierId: selectedCaissierId, type });
      setSelectedCaissierId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de démarrer la pause.");
    } finally {
      setActionLoading(false);
    }
  }

  async function endPause(id: number) {
    setError(null);
    setActionLoading(true);
    try {
      await api.post<Pause>(`/api/pauses/${id}/end`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de terminer la pause.");
    } finally {
      setActionLoading(false);
    }
  }

  function shiftDate(days: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(toISODate(d));
  }

  const currentlyOnBreakCount = caissiersEnPause.size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Pauses des caissiers</h1>
        <p className="text-sm text-slate-500">
          L&apos;accueil saisit ici le début et la fin des pauses de chaque caissier(ère) de la
          journée.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="Déclarer une nouvelle pause">
        {caissiers.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun caissier enregistré.{" "}
            <Link href="/accueil/caissiers" className="font-medium text-blue-600 hover:underline">
              Ajouter un caissier →
            </Link>
          </p>
        ) : caissiersDisponibles.length === 0 ? (
          <p className="text-sm text-slate-500">Tous les caissiers actifs sont déjà en pause.</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedCaissierId}
              onChange={(e) => setSelectedCaissierId(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {caissiersDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PauseType)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {PAUSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <Button disabled={actionLoading} onClick={startPause}>
              Démarrer la pause
            </Button>
          </div>
        )}
      </Card>

      <Card
        title={`Pauses du ${new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!loading && (
              <span className="text-xs text-slate-500">
                {currentlyOnBreakCount} en pause actuellement
              </span>
            )}
            <Button variant="secondary" onClick={() => shiftDate(-1)}>
              ←
            </Button>
            {!isToday(selectedDate) && (
              <Button variant="secondary" onClick={() => setSelectedDate(toISODate(new Date()))}>
                Aujourd&apos;hui
              </Button>
            )}
            <Button variant="secondary" onClick={() => shiftDate(1)}>
              →
            </Button>
          </div>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : pauses.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune pause enregistrée pour cette journée.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Caissier(ère)</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Début</th>
                  <th className="py-2 pr-4">Fin</th>
                  <th className="py-2 pr-4">Durée</th>
                  <th className="py-2 pr-4">Déclarée par</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pauses.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">
                      {p.user.firstName} {p.user.lastName}
                    </td>
                    <td className="py-2 pr-4">{p.type}</td>
                    <td className="py-2 pr-4">{formatFrenchTimeOfDate(p.startedAt)}</td>
                    <td className="py-2 pr-4">
                      {p.endedAt ? formatFrenchTimeOfDate(p.endedAt) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {p.endedAt
                        ? `${Math.round(
                            (new Date(p.endedAt).getTime() - new Date(p.startedAt).getTime()) / 60000,
                          )} min`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">
                      {p.declaredBy ? `${p.declaredBy.firstName} ${p.declaredBy.lastName}` : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge tone={p.status}>{p.status}</Badge>
                    </td>
                    <td className="py-2">
                      {p.status === "EN_COURS" && (
                        <Button variant="danger" disabled={actionLoading} onClick={() => endPause(p.id)}>
                          Terminer
                        </Button>
                      )}
                    </td>
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
