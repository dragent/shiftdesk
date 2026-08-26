"use client";

import { useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { usePageQuery } from "@/lib/usePageQuery";
import type { InsightStatus, PlanningInsight } from "@/lib/types";

function toISODate(date: Date): string {
  // Formatted in local time (not toISOString(), which converts to UTC and
  // would shift the date by one day depending on the time zone).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SupervisionIaPage() {
  return (
    <RoleGuard roles={["ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <SupervisionContent />
      </AppShell>
    </RoleGuard>
  );
}

function SupervisionContent() {
  const [analyzing, setAnalyzing] = useState(false);

  const { data: insights = [], loading, error, setError, refetch } = usePageQuery({
    queryKey: queryKeys.insights,
    queryFn: () => api.get<PlanningInsight[]>("/api/ai/insights"),
  });

  async function runAnalysis() {
    setError(null);
    setAnalyzing(true);
    try {
      const today = new Date();
      const from = toISODate(today);
      const to = toISODate(new Date(today.getTime() + 6 * 86400000));
      await api.post("/api/ai/analyze", { from, to });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analyse IA impossible pour le moment.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function updateStatus(id: number, status: InsightStatus) {
    try {
      await api.patch(`/api/ai/insights/${id}`, { status });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Mise à jour impossible.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Supervision IA — Planning</h1>
          <p className="text-sm text-slate-500">
            Détection automatique de sous-effectifs, surcharges et conflits de pauses sur les 7
            prochains jours.
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? "Analyse en cours..." : "Lancer une analyse"}
        </Button>
      </div>

      <Card>
        <p className="text-sm text-slate-500">
          Cette brique IA s&apos;appuie sur un micro-service dédié (
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">ai-service/</code>) qui pourra
          être enrichi avec de vrais modèles (prévision d&apos;affluence, détection d&apos;anomalies
          avancée...) sans changement côté application. En attendant, un moteur de règles simple
          détecte déjà les cas critiques.
        </p>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card title="Alertes actives">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune alerte active. Lancez une analyse pour vérifier la couverture des 7 prochains
            jours.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={insight.severity}>{insight.severity}</Badge>
                    <Badge>{insight.type.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-slate-400">
                      {new Date(insight.targetDate).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{insight.message}</p>
                </div>
                <select
                  value={insight.status}
                  onChange={(e) => updateStatus(insight.id, e.target.value as InsightStatus)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="NOUVELLE">Nouvelle</option>
                  <option value="VUE">Vue</option>
                  <option value="TRAITEE">Traitée</option>
                  <option value="IGNOREE">Ignorée</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
