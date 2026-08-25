"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

interface UnreadNotesContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const UnreadNotesContext = createContext<UnreadNotesContextValue | undefined>(undefined);

const POLL_MS = 30_000;
const APP_TITLE = "ShiftDesk";

/**
 * Tracks unread direction notes for the nav badge and browser tab title.
 * Polls regularly and exposes refresh() so the dashboard can update immediately after vu/clore.
 */
export function UnreadNotesProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const canReadNotes =
    Boolean(user) && hasRole("ROLE_DIRECTION", "ROLE_ADMIN", "ROLE_HOTE");

  const refreshUnreadCount = useCallback(async () => {
    if (!canReadNotes) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api.get<{ count: number }>("/api/direction-notes/unread-count");
      setUnreadCount(Math.max(0, Number(data.count) || 0));
    } catch {
      // Keep the last known count on transient errors.
    }
  }, [canReadNotes]);

  useEffect(() => {
    if (!canReadNotes) {
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();
    const id = window.setInterval(() => {
      void refreshUnreadCount();
    }, POLL_MS);

    const onFocus = () => {
      void refreshUnreadCount();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [canReadNotes, refreshUnreadCount]);

  useEffect(() => {
    document.title =
      unreadCount > 0 ? `(${unreadCount > 99 ? "99+" : unreadCount}) ${APP_TITLE}` : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [unreadCount]);

  return (
    <UnreadNotesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadNotesContext.Provider>
  );
}

export function useUnreadNotes(): UnreadNotesContextValue {
  const ctx = useContext(UnreadNotesContext);
  if (!ctx) {
    throw new Error("useUnreadNotes doit être utilisé dans un <UnreadNotesProvider>");
  }
  return ctx;
}
