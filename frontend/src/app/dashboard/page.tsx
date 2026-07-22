"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import type { AccueilRequest, Pause, PlanningInsight } from "@/lib/types";

export default function DashboardPage() {
  return (
    <RoleGuard>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </RoleGuard>
  );
}

function DashboardContent() {
  const { user, hasRole } = useAuth();
  const isDirectionOrAdmin = hasRole("ROLE_DIRECTION", "ROLE_ADMIN");

  const [ongoingPause, setOngoingPause] = useState<Pause | null>(null);
  const [recentRequests, setRecentRequests] = useState<AccueilRequest[]>([]);
  const [insights, setInsights] = useState<PlanningInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pauses, requests] = await Promise.all([
          api.get<Pause[]>("/api/pauses?mine=1"),
          api.get<AccueilRequest[]>("/api/requests?limit=5"),
        ]);
        setOngoingPause(pauses.find((p) => p.status === "EN_COURS") ?? null);
        setRecentRequests(requests);

        if (isDirectionOrAdmin) {
          const activeInsights = await api.get<PlanningInsight[]>("/api/ai/insights");
          setInsights(activeInsights);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isDirectionOrAdmin]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Bonjour {user?.firstName} 👋
        </h1>
        <p className="text-sm text-slate-500">
          Voici un aperçu de l&apos;activité de l&apos;accueil.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Statut pause">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : ongoingPause ? (
            <div className="flex flex-col gap-2">
              <Badge tone="EN_COURS">Pause en cours</Badge>
              <p className="text-sm text-slate-500">
                Démarrée à{" "}
                {new Date(ongoingPause.startedAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucune pause en cours.</p>
          )}
          <Link href="/accueil/pauses" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Gérer mes pauses →
          </Link>
        </Card>

        <Card title="Demandes récentes">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : recentRequests.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune demande enregistrée.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentRequests.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <Badge tone={r.status}>{r.category.label}</Badge>{" "}
                    <span className="text-slate-600">{r.subject}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/accueil/demandes" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Voir les demandes →
          </Link>
        </Card>

        {isDirectionOrAdmin && (
          <Card title="Supervision IA — Planning">
            {loading ? (
              <p className="text-sm text-slate-400">Chargement...</p>
            ) : insights.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune alerte active.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">{insights.length}</span> alerte(s) active(s)
                </p>
                <div className="flex flex-wrap gap-1">
                  {insights.slice(0, 3).map((i) => (
                    <Badge key={i.id} tone={i.severity}>
                      {i.type.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Link
              href="/direction/supervision-ia"
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Ouvrir la supervision IA →
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
