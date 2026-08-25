"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { Card, Button } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { useUnreadNotes } from "@/lib/UnreadNotesContext";
import { api, ApiError } from "@/lib/api";
import type { DirectionNote, DirectionNoteChannel } from "@/lib/types";

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
  const isHote = hasRole("ROLE_HOTE");
  const canSeeDirectionNotes = isDirectionOrAdmin;
  const canSeeAccueilNotes = isDirectionOrAdmin || isHote;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Bonjour {user?.firstName}
        </h1>
        <p className="text-sm text-slate-500">
          Notes de la direction pour l&apos;équipe.
        </p>
      </div>

      {(canSeeDirectionNotes || canSeeAccueilNotes) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {canSeeDirectionNotes && (
            <DirectionNotesCard
              title="Direction envers Direction"
              channel="DIRECTION_DIRECTION"
              canWrite={isDirectionOrAdmin}
              canClose={isDirectionOrAdmin}
              emptyLabel="Aucune note interne pour le moment."
            />
          )}
          {canSeeAccueilNotes && (
            <DirectionNotesCard
              title="Direction envers Accueil"
              channel="DIRECTION_ACCUEIL"
              canWrite={isDirectionOrAdmin}
              canClose={isDirectionOrAdmin}
              emptyLabel="Aucune note pour l'accueil pour le moment."
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Aucune note à afficher pour votre rôle.
        </p>
      )}
    </div>
  );
}

function DirectionNotesCard({
  title,
  channel,
  canWrite,
  canClose,
  emptyLabel,
}: {
  title: string;
  channel: DirectionNoteChannel;
  canWrite: boolean;
  canClose: boolean;
  emptyLabel: string;
}) {
  const [notes, setNotes] = useState<DirectionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<"close" | "seen" | null>(null);
  const { refreshUnreadCount } = useUnreadNotes();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DirectionNote[]>(
        `/api/direction-notes?channel=${encodeURIComponent(channel)}`,
      );
      setNotes(data.slice(0, 5));
      await refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les notes.");
    } finally {
      setLoading(false);
    }
  }, [channel, refreshUnreadCount]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      await api.post<DirectionNote>("/api/direction-notes", { channel, body: trimmed });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer la note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(id: number) {
    setPendingId(id);
    setPendingAction("close");
    setError(null);
    try {
      await api.patch<DirectionNote>(`/api/direction-notes/${id}/close`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de clore la note.");
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  }

  async function handleSeen(id: number) {
    setPendingId(id);
    setPendingAction("seen");
    setError(null);
    try {
      const updated = await api.post<DirectionNote>(`/api/direction-notes/${id}/seen`, {});
      setNotes((prev) =>
        prev.map((note) => (note.id === id ? { ...note, seenByMe: updated.seenByMe ?? true } : note)),
      );
      await refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de marquer la note comme vue.");
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  }

  return (
    <Card title={title}>
      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : notes.length === 0 ? (
        <p className="rounded-[var(--cf-radius-sm)] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {notes.map((note) => {
            const busy = pendingId === note.id;
            const seen = Boolean(note.seenByMe);

            return (
              <li
                key={note.id}
                className={`rounded-[var(--cf-radius-sm)] border bg-white px-3.5 py-3 shadow-[var(--cf-shadow-sm)] sm:px-4 ${
                  seen
                    ? "border-slate-200 border-l-[3px] border-l-emerald-600"
                    : "border-slate-200 border-l-[3px] border-l-[var(--cf-blue)]"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`whitespace-pre-wrap text-sm leading-relaxed ${
                        seen ? "text-slate-600" : "text-slate-800"
                      }`}
                    >
                      {truncateNote(note.body)}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">
                        {note.author.firstName} {note.author.lastName}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <time dateTime={note.createdAt}>{formatNoteDate(note.createdAt)}</time>
                      {seen && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 bg-emerald-50">
                            Vue
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
                    {!seen && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSeen(note.id)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-slate-200 bg-white text-base font-semibold text-[var(--cf-blue)] transition hover:border-[var(--cf-blue)] hover:bg-[var(--cf-blue-light)] disabled:opacity-60"
                        aria-label="Marquer comme vue"
                        title="Marquer comme vue"
                      >
                        {busy && pendingAction === "seen" ? "…" : "✓"}
                      </button>
                    )}
                    {canClose && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleClose(note.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-slate-200 bg-white px-3.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                        aria-label="Clore la note pour tout le monde"
                      >
                        {busy && pendingAction === "close" ? "…" : "Clore"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4"
        >
          <label className="sr-only" htmlFor={`note-${channel}`}>
            Nouvelle note
          </label>
          <textarea
            id={`note-${channel}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Écrire une note…"
            className="w-full rounded-[var(--cf-radius-sm)] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-[var(--cf-shadow-sm)] placeholder:text-slate-400 focus:border-[var(--cf-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-blue)]/20"
          />
          <Button type="submit" size="sm" disabled={saving || !body.trim()} className="self-end">
            {saving ? "Publication…" : "Ajouter la note"}
          </Button>
        </form>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function truncateNote(body: string, max = 220): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function formatNoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
