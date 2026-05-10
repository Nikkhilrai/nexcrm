/**
 * Browser-only token + user storage. SSR-safe (returns null when window is
 * undefined). Storage strategy = localStorage for v1 — adequate for an
 * internal CRM with ~5 users. Move to httpOnly cookies if we ever expose
 * this app to a hostile network.
 */
import type { User } from "./types";

const ACCESS_KEY = "mantranex.access";
const REFRESH_KEY = "mantranex.refresh";
const USER_KEY = "mantranex.user";

function isBrowser() {
  return typeof window !== "undefined";
}

export const tokens = {
  getAccess(): string | null {
    return isBrowser() ? window.localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefresh(): string | null {
    return isBrowser() ? window.localStorage.getItem(REFRESH_KEY) : null;
  },
  set(access: string, refresh: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

export const cachedUser = {
  get(): User | null {
    if (!isBrowser()) return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  set(user: User): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(USER_KEY);
  },
};
