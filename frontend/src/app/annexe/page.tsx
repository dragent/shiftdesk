"use client";

import { useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button, Alert } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { ANNEXE_ACCESS_JOBS, annexeJobLabel } from "@/lib/annexe";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { usePageQuery } from "@/lib/usePageQuery";
import type { AnnexeFile, AnnexeWebsite, UserRole } from "@/lib/types";

const EMPTY_WEBSITES: AnnexeWebsite[] = [];
const EMPTY_FILES: AnnexeFile[] = [];

const ANNEXE_ROLES: UserRole[] = [
  "ROLE_DIRECTEUR",
  "ROLE_DIRECTION",
  "ROLE_ADMIN",
  "ROLE_HOTE",
  "ROLE_CAISSIER",
  "ROLE_LAD",
  "ROLE_RAYON",
  "ROLE_SECURITE",
];

export default function AnnexePage() {
  return (
    <RoleGuard roles={ANNEXE_ROLES}>
      <AppShell>
        <AnnexeContent />
      </AppShell>
    </RoleGuard>
  );
}

function AnnexeContent() {
  const { hasRole } = useAuth();
  const canManageWebsites = hasRole("ROLE_DIRECTION", "ROLE_DIRECTEUR", "ROLE_ADMIN");
  const canManageFiles = hasRole("ROLE_DIRECTION", "ROLE_DIRECTEUR", "ROLE_ADMIN", "ROLE_HOTE");

  const websitesQuery = usePageQuery({
    queryKey: queryKeys.annexeWebsites,
    queryFn: () => api.get<AnnexeWebsite[]>("/api/annexe/websites"),
    fallbackError: "Impossible de charger les sites web.",
  });
  const filesQuery = usePageQuery({
    queryKey: queryKeys.annexeFiles,
    queryFn: () => api.get<AnnexeFile[]>("/api/annexe/files"),
    enabled: canManageFiles,
    fallbackError: "Impossible de charger les fichiers.",
  });

  const websites = websitesQuery.data ?? EMPTY_WEBSITES;
  const files = filesQuery.data ?? EMPTY_FILES;
  const error = websitesQuery.error ?? filesQuery.error;
  const setError = (message: string | null) => {
    websitesQuery.setError(message);
    filesQuery.setError(message);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Annexe</h1>
        <p className="text-sm text-slate-500">
          Sites web utiles selon le métier, et fichiers partagés entre la direction et
          l&apos;accueil.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <WebsitesSection
        websites={websites}
        loading={websitesQuery.loading}
        canManage={canManageWebsites}
        setError={setError}
        onChanged={() => websitesQuery.refetch()}
      />

      {canManageFiles && (
        <FilesSection
          files={files}
          loading={filesQuery.loading}
          setError={setError}
          onChanged={() => filesQuery.refetch()}
        />
      )}
    </div>
  );
}

function WebsitesSection({
  websites,
  loading,
  canManage,
  setError,
  onChanged,
}: {
  websites: AnnexeWebsite[];
  loading: boolean;
  canManage: boolean;
  setError: (message: string | null) => void;
  onChanged: () => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleRole(role: UserRole) {
    setAllowedRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (allowedRoles.length === 0) {
      setError("Choisissez au moins un métier autorisé à accéder au site.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post<AnnexeWebsite>("/api/annexe/websites", { name, url, allowedRoles });
      setName("");
      setUrl("");
      setAllowedRoles([]);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter le site web.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await api.delete(`/api/annexe/websites/${id}`);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer le site web.");
    }
  }

  return (
    <Card title="Sites web">
      {canManage && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="annexe-site-name">
                Nom du site
              </label>
              <input
                id="annexe-site-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Caroline"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="annexe-site-url">
                Adresse
              </label>
              <input
                id="annexe-site-url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://intranet.exemple"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">
              Métiers qui peuvent y accéder
            </legend>
            <div className="flex flex-wrap gap-2">
              {ANNEXE_ACCESS_JOBS.map((job) => {
                const checked = allowedRoles.includes(job.role);
                return (
                  <label
                    key={job.role}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? "border-[var(--cf-blue)] bg-[var(--cf-blue-light)] text-[var(--cf-blue-dark)]"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(job.role)}
                      className="h-4 w-4 accent-[var(--cf-blue)]"
                    />
                    {job.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="sm:justify-self-start">
            <Button type="submit" disabled={submitting} className="w-full justify-center sm:w-auto">
              Ajouter le site
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : websites.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun site web pour le moment.</p>
      ) : (
        <ul className="grid gap-3">
          {websites.map((website) => (
            <li
              key={website.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <a
                  href={website.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--cf-blue)] hover:underline"
                >
                  {website.name}
                </a>
                <p className="truncate text-sm text-slate-500">{website.url}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {website.allowedRoles.map((role) => (
                    <Badge key={role}>{annexeJobLabel(role)}</Badge>
                  ))}
                </div>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="danger"
                  className="w-full justify-center sm:w-auto"
                  onClick={() => remove(website.id)}
                >
                  Supprimer
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FilesSection({
  files,
  loading,
  setError,
  onChanged,
}: {
  files: AnnexeFile[];
  loading: boolean;
  setError: (message: string | null) => void;
  onChanged: () => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post<AnnexeFile>("/api/annexe/files", { name });
      setName("");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter le fichier.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await api.delete(`/api/annexe/files/${id}`);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer le fichier.");
    }
  }

  return (
    <Card title="Fichiers">
      <form onSubmit={handleSubmit} className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="annexe-file-name">
            Nom du fichier
          </label>
          <input
            id="annexe-file-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. consigne-accueil.pdf"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full justify-center sm:w-auto">
          Ajouter le fichier
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun fichier pour le moment.</p>
      ) : (
        <ul className="grid gap-3">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{file.name}</p>
                {file.createdBy && (
                  <p className="text-sm text-slate-500">
                    Ajouté par {file.createdBy.firstName} {file.createdBy.lastName}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="danger"
                className="w-full justify-center sm:w-auto"
                onClick={() => remove(file.id)}
              >
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
