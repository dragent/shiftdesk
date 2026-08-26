"use client";

import { useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { usePageQuery } from "@/lib/usePageQuery";
import type { Site, User } from "@/lib/types";

export default function CaissiersPage() {
  return (
    <RoleGuard roles={["ROLE_HOTE", "ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <CaissiersContent />
      </AppShell>
    </RoleGuard>
  );
}

function CaissiersContent() {
  const { hasRole } = useAuth();
  const canManage = hasRole("ROLE_DIRECTION", "ROLE_ADMIN");

  const { data, loading, error, setError, refetch } = usePageQuery({
    queryKey: queryKeys.caissiersPage,
    queryFn: async () => {
      const [caissiers, sites] = await Promise.all([
        api.get<User[]>("/api/caissiers"),
        api.get<Site[]>("/api/sites"),
      ]);
      return { caissiers, sites };
    },
  });
  const caissiers = data?.caissiers ?? [];
  const sites = data?.sites ?? [];
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cashierNumber, setCashierNumber] = useState("");
  const [siteId, setSiteId] = useState<number | "">("");
  const effectiveSiteId = siteId === "" ? (sites[0]?.id ?? "") : siteId;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await api.post<User>("/api/caissiers", {
        firstName,
        lastName,
        cashierNumber: cashierNumber.trim() || null,
        siteId: effectiveSiteId || null,
      });
      setFirstName("");
      setLastName("");
      setCashierNumber("");
      setSuccess("Caissier(ère) ajouté(e) avec succès.");
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter le caissier.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(caissier: User) {
    setError(null);
    try {
      await api.patch(`/api/caissiers/${caissier.id}`, { active: !caissier.active });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour le caissier.");
    }
  }

  async function updateSite(caissier: User, newSiteId: number) {
    setError(null);
    try {
      await api.patch(`/api/caissiers/${caissier.id}`, { siteId: newSiteId });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour le site.");
    }
  }

  async function updateCashierNumber(caissier: User, value: string) {
    setError(null);
    try {
      await api.patch(`/api/caissiers/${caissier.id}`, {
        cashierNumber: value.trim() || null,
      });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour le n° caissier.");
    }
  }

  async function remove(caissier: User) {
    setError(null);
    if (!window.confirm(`Supprimer ${caissier.firstName} ${caissier.lastName} ?`)) return;
    try {
      await api.delete(`/api/caissiers/${caissier.id}`);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer le caissier.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Caissiers</h1>
        <p className="text-sm text-slate-500">
          Liste des caissiers/caissières dont l&apos;accueil saisit les pauses.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {canManage && (
        <Card title="Nouveau caissier">
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Prénom</label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nom</label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">N° caissier</label>
              <input
                value={cashierNumber}
                onChange={(e) => setCashierNumber(e.target.value)}
                placeholder="Ex. 101"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Site</label>
              <select
                value={effectiveSiteId}
                onChange={(e) => setSiteId(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Ajout..." : "Ajouter le caissier"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Liste des caissiers">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : caissiers.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun caissier enregistré pour l&apos;instant.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">N° caissier</th>
                  <th className="py-2 pr-4">Site</th>
                  <th className="py-2 pr-4">Statut</th>
                  {canManage && <th className="py-2">Action</th>}
                </tr>
              </thead>
              <tbody>
                {caissiers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        defaultValue={c.cashierNumber ?? ""}
                        key={`${c.id}-${c.cashierNumber ?? ""}`}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          const prev = (c.cashierNumber ?? "").trim();
                          if (next !== prev) updateCashierNumber(c, next);
                        }}
                        placeholder="—"
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      {canManage ? (
                        <select
                          value={c.site?.id ?? ""}
                          onChange={(e) => updateSite(c, Number(e.target.value))}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{c.site?.name ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge tone={c.active ? "CONFIRME" : "ANNULE"}>
                        {c.active ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => toggleActive(c)}>
                            {c.active ? "Désactiver" : "Activer"}
                          </Button>
                          <Button variant="danger" onClick={() => remove(c)}>
                            Supprimer
                          </Button>
                        </div>
                      </td>
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
