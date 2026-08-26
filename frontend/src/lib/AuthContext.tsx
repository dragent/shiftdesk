"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, clearToken, getToken, login as apiLogin, setToken } from "./api";
import { useEffectLoad } from "./useEffectLoad";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/api/me");
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffectLoad(loadUser);

  const refreshUser = useCallback(async (next?: User) => {
    if (next) {
      setUser(next);
      return;
    }
    const me = await api.get<User>("/api/me");
    setUser(me);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { token } = await apiLogin(email, password);
    setToken(token);
    try {
      const me = await api.get<User>("/api/me");
      setUser(me);
      setLoading(false);
      return me;
    } catch (err) {
      // Login succeeded but the profile could not be loaded (e.g. missing
      // role on /api/me): drop the token so we do not bounce to
      // « session expirée », and surface a clear error instead.
      clearToken();
      setUser(null);
      setLoading(false);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw new ApiError(
          "Connexion refusée : ce compte n'a pas accès à l'application.",
          err.status,
        );
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.push("/login");
  }, [router]);

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
