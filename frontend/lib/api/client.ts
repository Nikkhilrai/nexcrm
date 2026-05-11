/**
 * Axios client with two interceptors:
 *  1. Request — attach Bearer access token if present.
 *  2. Response — on 401, attempt one refresh, retry the original request,
 *     and queue parallel 401s onto the same in-flight refresh promise so
 *     we don't fire N refresh calls when a page issues N requests.
 *
 * On any unrecoverable auth failure (refresh missing or refresh 401),
 * tokens are cleared and the browser is redirected to /login.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { cachedUser, tokens } from "./storage";
import type { RefreshResponse } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Django cursor pagination returns absolute URLs like http://34.56.168.240/api/leads/?cursor=...
 * In production these go through a Vercel proxy, so we must strip the origin
 * and use only the path+query — otherwise the browser fetches HTTP from an
 * HTTPS page and blocks it as mixed content.
 */
export function cursorPath(absoluteUrl: string): string {
  try {
    const u = new URL(absoluteUrl);
    return u.pathname + u.search;
  } catch {
    return absoluteUrl;
  }
}

export const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // Repeat array params (?status=NEW&status=CONTACTED) — Django filter
  // expects this form, not the default ?status[]=NEW&status[]=CONTACTED.
  paramsSerializer: {
    indexes: null,
  },
});

client.interceptors.request.use((config) => {
  const access = tokens.getAccess();
  if (access) {
    config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

function clearAuthAndRedirect() {
  tokens.clear();
  cachedUser.clear();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const refresh = tokens.getRefresh();
    if (!refresh) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      // Coalesce concurrent 401s into one refresh call.
      if (!refreshPromise) {
        refreshPromise = axios
          .post<RefreshResponse>(`${API_BASE_URL}/api/auth/refresh/`, { refresh })
          .then((res) => {
            tokens.set(res.data.access, res.data.refresh);
            return res.data.access;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const newAccess = await refreshPromise;
      original.headers.set("Authorization", `Bearer ${newAccess}`);
      return client(original);
    } catch (refreshError) {
      clearAuthAndRedirect();
      return Promise.reject(refreshError);
    }
  },
);
