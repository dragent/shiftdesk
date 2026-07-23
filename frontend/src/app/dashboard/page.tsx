"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { formatFrenchTimeOfDate } from "@/lib/planning";
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

  const [ongoingPauses, setOngoingPauses] = useState<Pause[]>([]);
  const [recentRequests, setRecentRequests] = useState<AccueilRequest[]>([]);
  const [insights, setInsights] = useState<PlanningInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Chaque appel est isolé (Promise.allSettled) : certains rôles (ex.
        // Rayon, Sécurité) n'ont pas accès aux pauses/demandes, on ne veut
        // pas qu'un 403 sur l'un empêche l'affichage du reste du tableau de
        // bord.
        const [pauses, requests] = await Promise.allSettled([
          api.get<Pause[]>("/api/pauses/ongoing"),
          api.get<AccueilRequest[]>("/api/requests?limit=5"),
        ]);
        if (pauses.status === "fulfilled") setOngoingPauses(pauses.value);
        if (requests.status === "fulfilled") setRecentRequests(requests.value);

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
        <Card title="Pauses caissiers en cours">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : ongoingPauses.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun caissier en pause actuellement.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ongoingPauses.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-600">
                    {p.user.firstName} {p.user.lastName}
                  </span>
                  <Badge tone="EN_COURS">{formatFrenchTimeOfDate(p.startedAt)}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href="/accueil/pauses" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Gérer les pauses →
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
