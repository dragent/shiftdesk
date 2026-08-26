"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError, clearToken, getToken, login as apiLogin, setToken } from "./api";
import { queryKeys } from "./queryKeys";
import type { User, UserRole } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: (next?: User) => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchCurrentUser(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    return await api.get<User>("/api/me");
  } catch {
    clearToken();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: user = null, isPending: loading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
    retry: false,
  });

  const refreshUser = useCallback(
    async (next?: User) => {
      if (next) {
        queryClient.setQueryData(queryKeys.me, next);
        return;
      }
      const me = await api.get<User>("/api/me");
      queryClient.setQueryData(queryKeys.me, me);
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const { token } = await apiLogin(email, password);
      setToken(token);
      try {
        const me = await api.get<User>("/api/me");
        queryClient.setQueryData(queryKeys.me, me);
        return me;
      } catch (err) {
        // Login succeeded but the profile could not be loaded (e.g. missing
        // role on /api/me): drop the token so we do not bounce to
        // « session expirée », and surface a clear error instead.
        clearToken();
        queryClient.setQueryData(queryKeys.me, null);
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          throw new ApiError(
            "Connexion refusée : ce compte n'a pas accès à l'application.",
            err.status,
          );
        }
        throw err;
      }
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    clearToken();
    queryClient.setQueryData(queryKeys.me, null);
    queryClient.removeQueries({ queryKey: queryKeys.unreadNotes });
    router.push("/login");
  }, [queryClient, router]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user?.roles) return false;
      return roles.some((role) => user.roles?.includes(role));
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans un <AuthProvider>");
  }
  return ctx;
}
