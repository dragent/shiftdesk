"use client";

import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Pause, PauseType } from "@/lib/types";

const PAUSE_TYPES: { value: PauseType; label: string }[] = [
  { value: "COURTE", label: "Pause courte" },
  { value: "DEJEUNER", label: "Pause déjeuner" },
  { value: "AUTRE", label: "Autre" },
];

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
  const [pauses, setPauses] = useState<Pause[]>([]);
  const [type, setType] = useState<PauseType>("COURTE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const ongoing = pauses.find((p) => p.status === "EN_COURS") ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Pause[]>("/api/pauses?mine=1");
      setPauses(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startPause() {
    setError(null);
    setActionLoading(true);
    try {
      await api.post<Pause>("/api/pauses/start", { type });
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Mes pauses</h1>
        <p className="text-sm text-slate-500">
          Déclarez le début et la fin de vos pauses en temps réel.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="Pause en cours">
        {ongoing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Badge tone="EN_COURS">{ongoing.type}</Badge>
              <span className="text-sm text-slate-600">
                Démarrée à{" "}
                {new Date(ongoing.startedAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <Button variant="danger" disabled={actionLoading} onClick={() => endPause(ongoing.id)}>
              Terminer la pause
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              Démarrer une pause
            </Button>
          </div>
        )}
      </Card>

      <Card title="Historique">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : pauses.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune pause enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Début</th>
                <th className="py-2 pr-4">Fin</th>
                <th className="py-2 pr-4">Durée</th>
                <th className="py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {pauses.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{p.type}</td>
                  <td className="py-2 pr-4">
                    {new Date(p.startedAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2 pr-4">
                    {p.endedAt ? new Date(p.endedAt).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {p.endedAt
                      ? `${Math.round(
                          (new Date(p.endedAt).getTime() - new Date(p.startedAt).getTime()) / 60000,
                        )} min`
                      : "—"}
                  </td>
                  <td className="py-2">
                    <Badge tone={p.status}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
