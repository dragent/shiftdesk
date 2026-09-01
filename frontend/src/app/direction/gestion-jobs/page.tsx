"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Alert, Button, Card } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { usePageQuery } from "@/lib/usePageQuery";
import { JOB_CATEGORY_DEFS, countByJob } from "@/lib/employees";
import type { Job, JobCategoryKey, User } from "@/lib/types";

const EMPTY_USERS: User[] = [];
const EMPTY_JOBS: Job[] = [];

export default function GestionJobsPage() {
  return (
    <RoleGuard roles={["ROLE_DIRECTION", "ROLE_ADMIN"]}>
      <AppShell>
        <GestionJobsContent />
      </AppShell>
    </RoleGuard>
  );
}

function GestionJobsContent() {
  const {
    data,
    loading,
    error,
    setError,
    refetch,
  } = usePageQuery({
    queryKey: queryKeys.jobsPage,
    queryFn: async () => {
      const [users, jobs] = await Promise.all([
        api.get<User[]>("/api/users"),
        api.get<Job[]>("/api/jobs"),
      ]);
      return { users, jobs };
    },
  });
  const users = data?.users ?? EMPTY_USERS;
  const jobs = data?.jobs ?? EMPTY_JOBS;
  const counts = useMemo(() => countByJob(users, jobs), [users, jobs]);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<JobCategoryKey>("ACCUEIL_CAISSE");
  const [openCategory, setOpenCategory] = useState<JobCategoryKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function addJob(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await api.post<Job>("/api/jobs", { category, label: label.trim() });
      setLabel("");
      setOpenCategory(category);
      setSuccess("Poste ajouté.");
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter ce poste.");
    } finally {
      setSaving(false);
    }
  }

  async function removeJob(job: Job) {
    if (job.protected) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/api/jobs/${job.id}`);
      setSuccess(`Poste « ${job.label} » supprimé.`);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer ce poste.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Gestion des jobs</h1>
        <p className="text-sm text-slate-500">
          Un directeur ou une directrice peut ajouter un métier dans une catégorie
          existante, et le retirer s’il n’y a encore aucun employé. Directeur/rice
          reste le métier intouchable de la catégorie Direction.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <Card title="Ajouter un poste">
        <form
          onSubmit={addJob}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="block min-w-0 flex-1 text-sm font-medium text-slate-700">
            Catégorie
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as JobCategoryKey)}
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              {JOB_CATEGORY_DEFS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 flex-[2] text-sm font-medium text-slate-700">
            Métier
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. Adjoint de direction"
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
            />
          </label>
          <Button type="submit" disabled={saving || label.trim() === ""} className="w-full sm:w-auto">
            {saving ? "Ajout…" : "Ajouter"}
          </Button>
        </form>
      </Card>

      <Card title="Postes par catégorie">
        <div className="flex flex-col gap-2">
          {JOB_CATEGORY_DEFS.map((cat) => {
            const inCategory = jobs.filter((job) => job.category === cat.key);
            const open = openCategory === cat.key;
            const panelId = `jobs-category-${cat.key}`;
            return (
              <div key={cat.key} className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenCategory(open ? null : cat.key)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <span className="text-sm font-semibold text-slate-800">{cat.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap text-xs font-medium text-slate-500">
                      {inCategory.length <= 1
                        ? `${inCategory.length} poste`
                        : `${inCategory.length} postes`}
                    </span>
                    <span
                      className={`text-[10px] text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
                      aria-hidden
                    >
                      ▾
                    </span>
                  </span>
                </button>
                {open ? (
                  <div id={panelId} className="border-t border-slate-200 px-3 py-2.5">
                    {inCategory.length === 0 && !loading ? (
                      <p className="text-sm text-slate-400">Aucun poste</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {inCategory.map((job) => {
                          const count = counts[job.code] ?? job.occupantCount ?? 0;
                          const canDelete = !job.protected && count === 0;
                          return (
                            <li
                              key={job.id}
                              className="flex items-center justify-between gap-3 text-sm text-slate-700"
                            >
                              <span className="min-w-0 truncate">
                                {job.label}
                                {job.protected ? (
                                  <span className="ml-1.5 text-[11px] font-medium text-slate-400">
                                    intouchable
                                  </span>
                                ) : null}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <JobHeadcount count={count} loading={loading} />
                                <button
                                  type="button"
                                  disabled={!canDelete}
                                  onClick={() => removeJob(job)}
                                  title={
                                    job.protected
                                      ? "Le poste de directeur/rice ne peut pas être supprimé"
                                      : count > 0
                                        ? "Impossible : des personnes occupent encore ce poste"
                                        : `Supprimer ${job.label}`
                                  }
                                  className="min-h-11 min-w-11 rounded-md px-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                                >
                                  Retirer
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function JobHeadcount({ count, loading }: { count: number; loading: boolean }) {
  if (loading) {
    return <span className="text-xs text-slate-400">…</span>;
  }

  return (
    <span
      className="inline-flex min-w-5 justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
      aria-label={`${count} personne${count > 1 ? "s" : ""} à ce poste`}
    >
      {count}
    </span>
  );
}
