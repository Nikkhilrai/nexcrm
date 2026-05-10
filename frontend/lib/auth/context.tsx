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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first mount: hydrate from localStorage. If we have an access token,
  // optimistically trust the cached user; in the background, refresh from
  // /api/auth/me/ to pick up role flips or deactivation done by an admin
  // since this user last loaded the app.
  useEffect(() => {
    const cached = cachedUser.get();
    if (cached) setUser(cached);

    if (tokens.getAccess()) {
      api.auth
        .me()
        .then((u) => setUser(u))
        .catch(() => {
          // /me/ failed and the refresh interceptor couldn't recover —
          // tokens are already cleared by the interceptor. Surface as
          // "not signed in".
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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
