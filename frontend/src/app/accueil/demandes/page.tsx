"use client";

import { useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { usePageQuery } from "@/lib/usePageQuery";
import type { AccueilRequest, DemandeStatus, RequestCategory } from "@/lib/types";

const STATUS_OPTIONS: DemandeStatus[] = ["NOUVELLE", "EN_COURS", "TRAITEE", "ANNULEE"];

export default function DemandesPage() {
  return (
    <RoleGuard roles={["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_DIRECTEUR", "ROLE_ADMIN"]}>
      <AppShell>
        <DemandesContent />
      </AppShell>
    </RoleGuard>
  );
}

function DemandesContent() {
  const { data, loading, error, setError, refetch } = usePageQuery({
    queryKey: queryKeys.demandesPage,
    queryFn: async () => {
      const [categories, requests] = await Promise.all([
        api.get<RequestCategory[]>("/api/categories?active=1"),
        api.get<AccueilRequest[]>("/api/requests?limit=30"),
      ]);
      return { categories, requests };
    },
  });
  const categories = data?.categories ?? [];
  const requests = data?.requests ?? [];
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [visitorName, setVisitorName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const effectiveCategoryId = categoryId === "" ? (categories[0]?.id ?? "") : categoryId;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!effectiveCategoryId) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await api.post<AccueilRequest>("/api/requests", {
        categoryId: effectiveCategoryId,
        visitorName: visitorName || null,
        subject,
        description: description || null,
      });
      setSubject("");
      setVisitorName("");
      setDescription("");
      setSuccess("Demande enregistrée avec succès.");
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer la demande.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: number, status: DemandeStatus) {
    try {
      await api.patch(`/api/requests/${id}`, { status });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour le statut.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Demandes accueil</h1>
        <p className="text-sm text-slate-500">
          Enregistrez chaque demande traitée et classez-la selon sa catégorie.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <Card title="Nouvelle demande">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Catégorie</label>
            <select
              required
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom du visiteur/client (optionnel)
            </label>
            <input
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Sujet</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ex. Panne caisse 3, demande d'information produit..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting || categories.length === 0}>
              {submitting ? "Enregistrement..." : "Enregistrer la demande"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Demandes récentes">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune demande enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Catégorie</th>
                  <th className="py-2 pr-4">Sujet</th>
                  <th className="py-2 pr-4">Hôte(sse)</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge>{r.category.label}</Badge>
                    </td>
                    <td className="py-2 pr-4">{r.subject}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {r.hote.firstName} {r.hote.lastName}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge tone={r.status}>{r.status}</Badge>
                    </td>
                    <td className="py-2">
                      <select
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value as DemandeStatus)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
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
