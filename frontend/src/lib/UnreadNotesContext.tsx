"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { useEffectLoad } from "./useEffectLoad";
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const previousCountRef = useRef<number | null>(null);
  const previousLatestRef = useRef<string | null>(null);
  const pollMsRef = useRef(POLL_FOCUSED_MS);

  const canReadNotes =
    Boolean(user) && hasRole("ROLE_DIRECTION", "ROLE_ADMIN", "ROLE_HOTE");

  const displayedUnreadCount = canReadNotes ? unreadCount : 0;

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const refreshUnreadCount = useCallback(async () => {
    if (!canReadNotes) {
      setUnreadCount(0);
      previousCountRef.current = 0;
      previousLatestRef.current = null;
      return;
    }
    try {
      const data = await api.get<UnreadNotesSummary>("/api/direction-notes/unread-count");
      const nextCount = Math.max(0, Number(data.count) || 0);
      const nextLatest = data.latestCreatedAt ?? null;

      const prevCount = previousCountRef.current;
      const prevLatest = previousLatestRef.current;
      if (
        prevCount !== null &&
        (nextCount > prevCount ||
          (nextLatest && nextLatest !== prevLatest && nextCount > 0))
      ) {
        const delta = Math.max(1, nextCount - (prevCount ?? 0));
        setToastMessage(
          delta === 1
            ? "Nouvelle note de la direction"
            : `${delta} nouvelles notes de la direction`,
        );
      }

      previousCountRef.current = nextCount;
      previousLatestRef.current = nextLatest;
      setUnreadCount(nextCount);
    } catch {
      // Keep the last known count on transient errors.
    }
  }, [canReadNotes]);

  useEffectLoad(refreshUnreadCount, canReadNotes);

  useEffect(() => {
    if (!canReadNotes) {
      previousCountRef.current = 0;
      previousLatestRef.current = null;
      return;
    }

    let id = window.setInterval(() => {
      void refreshUnreadCount();
    }, pollMsRef.current);

    const restartInterval = () => {
      window.clearInterval(id);
      id = window.setInterval(() => {
        void refreshUnreadCount();
      }, pollMsRef.current);
    };

    const onFocus = () => {
      pollMsRef.current = POLL_FOCUSED_MS;
      restartInterval();
      void refreshUnreadCount();
    };
    const onBlur = () => {
      pollMsRef.current = POLL_BLURRED_MS;
      restartInterval();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        onFocus();
      } else {
        onBlur();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canReadNotes, refreshUnreadCount]);

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
