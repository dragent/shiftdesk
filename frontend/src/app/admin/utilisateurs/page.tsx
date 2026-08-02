"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Site, User } from "@/lib/types";

const ROLE_OPTIONS = [
  { value: "HOTE", label: "Hôte(sse) d'accueil" },
  { value: "LAD", label: "LAD" },
  { value: "DIRECTION", label: "Direction" },
  { value: "RAYON", label: "Rayon" },
  { value: "SECURITE", label: "Sécurité" },
  { value: "ADMIN", label: "Administrateur" },
];

export default function UtilisateursPage() {
  return (
    <RoleGuard roles={["ROLE_ADMIN"]}>
      <AppShell>
        <UtilisateursContent />
      </AppShell>
    </RoleGuard>
  );
}

function UtilisateursContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("HOTE");
  const [siteId, setSiteId] = useState<number | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, sitesData] = await Promise.all([
        api.get<User[]>("/api/users"),
        api.get<Site[]>("/api/sites"),
      ]);
      setUsers(usersData);
      setSites(sitesData);
      if (sitesData.length > 0) setSiteId(sitesData[0].id);
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
    setSuccess(null);
    setSubmitting(true);
    try {
      await api.post<User>("/api/users", {
        firstName,
        lastName,
        email,
        password,
        role,
        siteId: siteId || null,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setSuccess("Utilisateur créé avec succès.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer l'utilisateur.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      await api.patch(`/api/users/${user.id}`, { active: !user.active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour l'utilisateur.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Utilisateurs</h1>
        <p className="text-sm text-slate-500">
          Créez les comptes Direction, Hôtes/Hôtesses d&apos;accueil, Rayon et Sécurité.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <Card title="Nouvel utilisateur">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Site</label>
            <select
              value={siteId}
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
          <div className="sm:col-span-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Création..." : "Créer l'utilisateur"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Liste des utilisateurs">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Rôle</th>
                  <th className="py-2 pr-4">Site</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">
                      {u.roles?.filter((r) => r !== "ROLE_USER").join(", ")}
                    </td>
                    <td className="py-2 pr-4">{u.site?.name ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={u.active ? "CONFIRME" : "ANNULE"}>
                        {u.active ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Button variant="secondary" onClick={() => toggleActive(u)}>
                        {u.active ? "Désactiver" : "Activer"}
                      </Button>
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
