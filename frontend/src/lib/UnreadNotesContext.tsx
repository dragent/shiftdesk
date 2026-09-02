"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { queryKeys } from "./queryKeys";
import type { UnreadNotesSummary } from "./types";

interface UnreadNotesContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  toastMessage: string | null;
  dismissToast: () => void;
}

const UnreadNotesContext = createContext<UnreadNotesContextValue | undefined>(undefined);

const POLL_FOCUSED_MS = 15_000;
const POLL_BLURRED_MS = 60_000;
const APP_TITLE = "ShiftDesk";

/**
 * Tracks unread direction notes for the nav badge, browser tab title,
 * and a live-region toast when new notes arrive.
 *
 * Polls more often while the tab is visible; refreshes on focus/visibility.
 */
export function UnreadNotesProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(POLL_FOCUSED_MS);
  const [prevSnapshot, setPrevSnapshot] = useState<{
    count: number;
    latest: string | null;
  } | null>(null);

  const canReadNotes =
    Boolean(user) && hasRole("ROLE_DIRECTION", "ROLE_DIRECTEUR", "ROLE_ADMIN", "ROLE_HOTE");

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const { data: summary, refetch } = useQuery({
    queryKey: queryKeys.unreadNotes,
    queryFn: async (): Promise<UnreadNotesSummary> => {
      const data = await api.get<UnreadNotesSummary>("/api/direction-notes/unread-count");
      return {
        count: Math.max(0, Number(data.count) || 0),
        latestCreatedAt: data.latestCreatedAt ?? null,
      };
    },
    enabled: canReadNotes,
    refetchInterval: pollMs,
    refetchOnWindowFocus: true,
    retry: false,
  });

  if (!canReadNotes) {
    if (prevSnapshot !== null) setPrevSnapshot(null);
  } else if (summary) {
    const nextCount = Math.max(0, Number(summary.count) || 0);
    const nextLatest = summary.latestCreatedAt ?? null;
    if (prevSnapshot === null) {
      setPrevSnapshot({ count: nextCount, latest: nextLatest });
    } else if (prevSnapshot.count !== nextCount || prevSnapshot.latest !== nextLatest) {
      if (
        nextCount > prevSnapshot.count ||
        (nextLatest && nextLatest !== prevSnapshot.latest && nextCount > 0)
      ) {
        const delta = Math.max(1, nextCount - prevSnapshot.count);
        setToastMessage(
          delta === 1
            ? "Nouvelle note de la direction"
            : `${delta} nouvelles notes de la direction`,
        );
      }
      setPrevSnapshot({ count: nextCount, latest: nextLatest });
    }
  }

  const displayedUnreadCount = canReadNotes ? (summary?.count ?? 0) : 0;

  const refreshUnreadCount = useCallback(async () => {
    if (!canReadNotes) return;
    await refetch();
  }, [canReadNotes, refetch]);

  useEffect(() => {
    const onFocus = () => setPollMs(POLL_FOCUSED_MS);
    const onBlur = () => setPollMs(POLL_BLURRED_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
      else onBlur();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    document.title =
      displayedUnreadCount > 0
        ? `(${displayedUnreadCount > 99 ? "99+" : displayedUnreadCount}) ${APP_TITLE}`
        : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [displayedUnreadCount]);

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 6_000);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  return (
    <UnreadNotesContext.Provider
      value={{ unreadCount: displayedUnreadCount, refreshUnreadCount, toastMessage, dismissToast }}
    >
      {children}
      <UnreadNotesLiveRegion count={displayedUnreadCount} toastMessage={toastMessage} onDismiss={dismissToast} />
    </UnreadNotesContext.Provider>
  );
}

function UnreadNotesLiveRegion({
  count,
  toastMessage,
  onDismiss,
}: {
  count: number;
  toastMessage: string | null;
  onDismiss: () => void;
}) {
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {count > 0
          ? `${count} note${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`
          : "Aucune note non lue"}
      </div>
      {toastMessage && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed bottom-4 left-4 right-4 z-[80] mx-auto flex max-w-md items-start justify-between gap-3 rounded-[var(--cf-radius)] border border-[var(--cf-blue)] bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-[var(--cf-shadow)] sm:left-auto sm:right-6"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-slate-500 hover:text-slate-800"
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export function useUnreadNotes(): UnreadNotesContextValue {
  const ctx = useContext(UnreadNotesContext);
  if (!ctx) {
    throw new Error("useUnreadNotes doit être utilisé dans un <UnreadNotesProvider>");
  }
  return ctx;
}
