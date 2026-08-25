"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, Button } from "@/components/ui";
import { useUnreadNotes } from "@/lib/UnreadNotesContext";
import { api, ApiError } from "@/lib/api";
import type {
  DirectionNote,
  DirectionNoteChannel,
  DirectionNotePriority,
  DirectionNoteReader,
} from "@/lib/types";

const OPEN_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 10;
const PREVIEW_LEN = 220;

export function DirectionNotesCard({
  title,
  channel,
  canWrite,
  canManage,
  emptyLabel,
}: {
  title: string;
  channel: DirectionNoteChannel;
  canWrite: boolean;
  /** Direction/Admin: close, edit, delete, history, readers */
  canManage: boolean;
  emptyLabel: string;
}) {
  const [notes, setNotes] = useState<DirectionNote[]>([]);
  const [closedNotes, setClosedNotes] = useState<DirectionNote[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [openLimit, setOpenLimit] = useState(OPEN_PAGE_SIZE);
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editUrgent, setEditUrgent] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [readersFor, setReadersFor] = useState<number | null>(null);
  const [readers, setReaders] = useState<DirectionNoteReader[]>([]);
  const { refreshUnreadCount } = useUnreadNotes();

  const loadOpen = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DirectionNote[]>(
        `/api/direction-notes?channel=${encodeURIComponent(channel)}&status=open&limit=${openLimit}`,
      );
      setNotes(data);
      await refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les notes.");
    } finally {
      setLoading(false);
    }
  }, [channel, openLimit, refreshUnreadCount]);

  const loadHistory = useCallback(async () => {
    if (!canManage) return;
    try {
      const data = await api.get<DirectionNote[]>(
        `/api/direction-notes?channel=${encodeURIComponent(channel)}&status=closed&limit=${historyLimit}`,
      );
      setClosedNotes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger l'historique.");
    }
  }, [canManage, channel, historyLimit]);

  useEffect(() => {
    void loadOpen();
  }, [loadOpen]);

  useEffect(() => {
    if (showHistory) void loadHistory();
  }, [showHistory, loadHistory]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      await api.post<DirectionNote>("/api/direction-notes", {
        channel,
        body: trimmed,
        priority: (urgent ? "URGENT" : "NORMAL") as DirectionNotePriority,
      });
      setBody("");
      setUrgent(false);
      await loadOpen();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer la note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(id: number) {
    if (!window.confirm("Clore cette note pour tout le monde ?")) return;
    setPendingId(id);
    setPendingAction("close");
    setError(null);
    try {
      await api.patch<DirectionNote>(`/api/direction-notes/${id}/close`, {});
      await loadOpen();
      if (showHistory) await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de clore la note.");
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Supprimer définitivement cette note ?")) return;
    setPendingId(id);
    setPendingAction("delete");
    setError(null);
    try {
      await api.delete(`/api/direction-notes/${id}`);
      await loadOpen();
      if (showHistory) await loadHistory();
      await refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer la note.");
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
        prev.map((note) =>
          note.id === id
            ? {
                ...note,
                seenByMe: updated.seenByMe ?? true,
                seenCount: (note.seenCount ?? 0) + (note.seenByMe ? 0 : 1),
              }
            : note,
        ),
      );
      await refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de marquer la note comme vue.");
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  }

  async function handleSaveEdit(id: number) {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    setPendingId(id);
    setPendingAction("edit");
    setError(null);
    try {
      await api.patch<DirectionNote>(`/api/direction-notes/${id}`, {
        body: trimmed,
        priority: (editUrgent ? "URGENT" : "NORMAL") as DirectionNotePriority,
      });
      setEditingId(null);
      await loadOpen();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de modifier la note.");
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  }

  async function toggleReaders(id: number) {
    if (readersFor === id) {
      setReadersFor(null);
      setReaders([]);
      return;
    }
    setPendingId(id);
    setPendingAction("readers");
    setError(null);
    try {
      const data = await api.get<DirectionNoteReader[]>(`/api/direction-notes/${id}/readers`);
      setReaders(data);
      setReadersFor(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les lecteurs.");
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  }

  function startEdit(note: DirectionNote) {
    setEditingId(note.id);
    setEditBody(note.body);
    setEditUrgent(note.priority === "URGENT");
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <Card title={title}>
      {canManage && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              !showHistory
                ? "bg-[var(--cf-blue)] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Ouvertes
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              showHistory
                ? "bg-[var(--cf-blue)] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Historique
          </button>
        </div>
      )}

      {loading && !showHistory ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : showHistory ? (
        closedNotes.length === 0 ? (
          <p className="rounded-[var(--cf-radius-sm)] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
            Aucune note close pour le moment.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {closedNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  closed
                  expanded={Boolean(expandedIds[note.id])}
                  onToggleExpand={() => toggleExpand(note.id)}
                  canManage={canManage}
                  busy={pendingId === note.id}
                  pendingAction={pendingAction}
                  editing={false}
                  editBody=""
                  editUrgent={false}
                  onEditBody={() => undefined}
                  onEditUrgent={() => undefined}
                  onStartEdit={() => undefined}
                  onCancelEdit={() => undefined}
                  onSaveEdit={() => undefined}
                  onSeen={() => undefined}
                  onClose={() => undefined}
                  onDelete={() => handleDelete(note.id)}
                  onReaders={() => toggleReaders(note.id)}
                  readersOpen={readersFor === note.id}
                  readers={readersFor === note.id ? readers : []}
                />
              ))}
            </ul>
            {closedNotes.length >= historyLimit && (
              <button
                type="button"
                className="mt-3 text-sm font-medium text-[var(--cf-blue)] hover:underline"
                onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
              >
                Voir plus
              </button>
            )}
          </>
        )
      ) : notes.length === 0 ? (
        <p className="rounded-[var(--cf-radius-sm)] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                closed={false}
                expanded={Boolean(expandedIds[note.id])}
                onToggleExpand={() => toggleExpand(note.id)}
                canManage={canManage}
                busy={pendingId === note.id}
                pendingAction={pendingAction}
                editing={editingId === note.id}
                editBody={editBody}
                editUrgent={editUrgent}
                onEditBody={setEditBody}
                onEditUrgent={setEditUrgent}
                onStartEdit={() => startEdit(note)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={() => handleSaveEdit(note.id)}
                onSeen={() => handleSeen(note.id)}
                onClose={() => handleClose(note.id)}
                onDelete={() => handleDelete(note.id)}
                onReaders={() => toggleReaders(note.id)}
                readersOpen={readersFor === note.id}
                readers={readersFor === note.id ? readers : []}
              />
            ))}
          </ul>
          {notes.length >= openLimit && (
            <button
              type="button"
              className="mt-3 text-sm font-medium text-[var(--cf-blue)] hover:underline"
              onClick={() => setOpenLimit((n) => n + OPEN_PAGE_SIZE)}
            >
              Voir plus
            </button>
          )}
        </>
      )}

      {canWrite && !showHistory && (
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="size-4 accent-[var(--cf-red)]"
              />
              Urgente
            </label>
            <Button type="submit" size="sm" disabled={saving || !body.trim()}>
              {saving ? "Publication…" : "Ajouter la note"}
            </Button>
          </div>
        </form>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function NoteItem({
  note,
  closed,
  expanded,
  onToggleExpand,
  canManage,
  busy,
  pendingAction,
  editing,
  editBody,
  editUrgent,
  onEditBody,
  onEditUrgent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSeen,
  onClose,
  onDelete,
  onReaders,
  readersOpen,
  readers,
}: {
  note: DirectionNote;
  closed: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  canManage: boolean;
  busy: boolean;
  pendingAction: string | null;
  editing: boolean;
  editBody: string;
  editUrgent: boolean;
  onEditBody: (v: string) => void;
  onEditUrgent: (v: boolean) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onSeen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onReaders: () => void;
  readersOpen: boolean;
  readers: DirectionNoteReader[];
}) {
  const seen = Boolean(note.seenByMe);
  const urgent = note.priority === "URGENT";
  const isLong = note.body.trim().length > PREVIEW_LEN;
  const displayBody =
    !expanded && isLong ? `${note.body.trim().slice(0, PREVIEW_LEN - 1)}…` : note.body;

  return (
    <li
      className={`rounded-[var(--cf-radius-sm)] border bg-white px-3.5 py-3 shadow-[var(--cf-shadow-sm)] sm:px-4 ${
        closed
          ? "border-slate-200 border-l-[3px] border-l-slate-400 opacity-90"
          : urgent
            ? "border-slate-200 border-l-[3px] border-l-[var(--cf-red)]"
            : seen
              ? "border-slate-200 border-l-[3px] border-l-emerald-600"
              : "border-slate-200 border-l-[3px] border-l-[var(--cf-blue)]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editBody}
                onChange={(e) => onEditBody(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-[var(--cf-radius-sm)] border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editUrgent}
                  onChange={(e) => onEditUrgent(e.target.checked)}
                  className="size-4 accent-[var(--cf-red)]"
                />
                Urgente
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSaveEdit}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-[var(--cf-blue)] bg-[var(--cf-blue)] text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  aria-label="Enregistrer la modification"
                  title="Enregistrer"
                >
                  {busy && pendingAction === "edit" ? "…" : "✓"}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-slate-200 bg-white text-base font-semibold text-slate-500 transition hover:bg-slate-50"
                  onClick={onCancelEdit}
                  aria-label="Annuler la modification"
                  title="Annuler"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <>
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed ${
                  seen || closed ? "text-slate-600" : "text-slate-800"
                }`}
              >
                {displayBody}
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="mt-1 text-xs font-semibold text-[var(--cf-blue)] hover:underline"
                >
                  {expanded ? "Réduire" : "Lire la suite"}
                </button>
              )}
            </>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {urgent && !closed && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-red)] bg-red-50">
                Urgent
              </span>
            )}
            <span className="font-medium text-slate-600">
              {note.author.firstName} {note.author.lastName}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <time dateTime={note.createdAt}>{formatNoteDate(note.createdAt)}</time>
            {closed && note.closedAt && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span>Close le {formatNoteDate(note.closedAt)}</span>
              </>
            )}
            {seen && !closed && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 bg-emerald-50">
                  Vue
                </span>
              </>
            )}
            {canManage && typeof note.seenCount === "number" && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onReaders}
                  className="font-medium text-[var(--cf-blue)] hover:underline"
                >
                  {note.seenCount} vu{note.seenCount > 1 ? "s" : ""}
                </button>
              </>
            )}
          </p>
          {readersOpen && (
            <ul className="mt-2 space-y-1 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {readers.length === 0 ? (
                <li>Personne n&apos;a encore marqué cette note comme vue.</li>
              ) : (
                readers.map((r) => (
                  <li key={`${r.user.id}-${r.seenAt}`}>
                    {r.user.firstName} {r.user.lastName} — {formatNoteDate(r.seenAt)}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {!closed && !editing && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
            {!seen && (
              <button
                type="button"
                disabled={busy}
                onClick={onSeen}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-slate-200 bg-white text-base font-semibold text-[var(--cf-blue)] transition hover:border-[var(--cf-blue)] hover:bg-[var(--cf-blue-light)] disabled:opacity-60"
                aria-label="Marquer comme vue"
                title="Marquer comme vue"
              >
                {busy && pendingAction === "seen" ? "…" : "✓"}
              </button>
            )}
            {canManage && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onStartEdit}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-slate-200 bg-white text-base font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Éditer la note"
                  title="Éditer"
                >
                  ✎
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-slate-200 bg-white text-base font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Clore la note pour tout le monde"
                  title="Clore"
                >
                  {busy && pendingAction === "close" ? "…" : "✕"}
                </button>
              </>
            )}
          </div>
        )}
        {closed && canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--cf-radius-sm)] border border-red-100 bg-white text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            aria-label="Supprimer définitivement la note archivée"
            title="Supprimer"
          >
            {busy && pendingAction === "delete" ? (
              "…"
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7h16" />
                <path d="M10 11h4" />
                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
                <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            )}
          </button>
        )}
      </div>
    </li>
  );
}

export function formatNoteDate(value: string): string {
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

export function truncateNote(body: string, max = PREVIEW_LEN): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
