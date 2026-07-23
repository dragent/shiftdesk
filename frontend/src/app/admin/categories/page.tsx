"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { RequestCategory } from "@/lib/types";

export default function CategoriesPage() {
  return (
    <RoleGuard roles={["ROLE_ADMIN"]}>
      <AppShell>
        <CategoriesContent />
      </AppShell>
    </RoleGuard>
  );
}

function CategoriesContent() {
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<RequestCategory[]>("/api/categories");
      setCategories(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post<RequestCategory>("/api/categories", {
        code: code.toUpperCase().replace(/\s+/g, "_"),
        label,
        description: description || null,
        position,
      });
      setCode("");
      setLabel("");
      setDescription("");
      setPosition(0);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer la catégorie.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(category: RequestCategory) {
    try {
      await api.patch(`/api/categories/${category.id}`, { active: !category.active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour la catégorie.");
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/api/categories/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer la catégorie.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Catégories de demandes</h1>
        <p className="text-sm text-slate-500">
          Ce sont les options affichées dans le menu déroulant lors de la saisie d&apos;une demande
          à l&apos;accueil (ex. Caroline, Siebel, Menu Carrefour). Ajoutez, renommez ou désactivez-en
          librement, sans redéploiement.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="Nouvelle catégorie">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="EX_CODE"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Libellé</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. Caroline"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Position</label>
            <input
              type="number"
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={submitting} className="w-full justify-center">
              Ajouter
            </Button>
          </div>
          <div className="sm:col-span-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description (optionnel)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </form>
      </Card>

      <Card title="Catégories existantes">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Libellé</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">{c.label}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.code}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.description ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={c.active ? "CONFIRME" : "ANNULE"}>
                        {c.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => toggleActive(c)}>
                          {c.active ? "Désactiver" : "Activer"}
                        </Button>
                        <Button variant="danger" onClick={() => remove(c.id)}>
                          Supprimer
                        </Button>
                      </div>
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
