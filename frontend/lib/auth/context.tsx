"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";

import { api, cachedUser, tokens, type User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  /** True until we've checked localStorage on first mount. */
  loading: boolean;
  /** Throws on bad creds — caller is expected to surface the error. */
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sameUser(a: User, b: User): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof User>;
  return [...keys].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first mount: hydrate from localStorage. With a token and a cached user
  // we render immediately and verify against /api/auth/me/ in the background
  // (role flips, deactivation). The backend still checks every data request.
  useEffect(() => {
    const hasToken = Boolean(tokens.getAccess());
    const cached = hasToken ? cachedUser.get() : null;
    if (cached) setUser(cached);

    if (!hasToken) {
      setLoading(false);
      return;
    }
    if (cached) setLoading(false);

    api.auth
      .me()
      .then((fresh) => {
        if (!tokens.getAccess()) return; // signed out while we were checking
        // Keep the same object when nothing changed: pages list `user` as an
        // effect dependency, so a new reference would make them refetch.
        setUser((prev) => (prev && sameUser(prev, fresh) ? prev : fresh));
      })
      .catch((e: unknown) => {
        const status = axios.isAxiosError(e) ? e.response?.status : undefined;
        if (!tokens.getAccess() || status === 401 || status === 403) {
          api.auth.logout();
          setUser(null);
        } else if (!cached) {
          setUser(null);
        }
        // A network blip or server error doesn't sign out a cached session.
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.auth.login(username, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    api.auth.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
