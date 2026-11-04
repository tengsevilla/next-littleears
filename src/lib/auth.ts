import { ApiClientError, apiClient } from "@/lib/api/apiClient";
import type { ApiResponse, AuthSession, User } from "@/lib/api/types";
import { clearOfflineCaches } from "@/lib/offline";
import { clearPlayQueue } from "@/lib/playQueue";

// Access token + user live in browser memory only — never localStorage, never a cookie we set.
// On the server this module is shared across requests, so the store is browser-only
// to avoid leaking one user's token into another request.
let accessToken: string | null = null;
let currentUser: User | null = null;
const isBrowser = typeof window !== "undefined";

export function getAccessToken(): string | null {
  return isBrowser ? accessToken : null;
}

export function setAccessToken(token: string | null): void {
  if (isBrowser) accessToken = token;
}

/** The signed-in user, or null when there is no in-memory session yet. */
export function getCurrentUser(): User | null {
  return isBrowser && accessToken ? currentUser : null;
}

function setSession(session: AuthSession | null): void {
  setAccessToken(session?.accessToken ?? null);
  if (isBrowser) currentUser = session?.user ?? null;
}

// Singleton in-flight promise: concurrent 401s share one refresh call, so the
// rotated refresh cookie is not replayed (which would log the user out).
let refreshPromise: Promise<AuthSession> | null = null;

export function refreshToken(): Promise<AuthSession> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as ApiResponse<AuthSession> | null;
        // ApiClientError carries the HTTP status, so callers can tell "signed out" (401) from "offline"
        // (fetch rejects with a TypeError and never gets here).
        if (!res.ok || !body?.data) {
          throw new ApiClientError(body?.error?.code ?? "HTTP_ERROR", body?.error?.message ?? "Refresh failed", res.status);
        }
        setSession(body.data);
        return body.data;
      })
      .catch((err: unknown) => {
        setSession(null);
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** POST /api/auth/login. Throws ApiClientError (e.g. INVALID_CREDENTIALS) on failure. */
export async function login(email: string, password: string): Promise<User> {
  const { data } = await apiClient<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setSession(data);
  return data.user;
}

/**
 * POST /api/auth/register from an invite link. Signs the new parent in exactly like login.
 * Throws ApiClientError: NOT_FOUND (invite unknown/expired/used), CONFLICT (email already registered).
 */
export async function register(token: string, password: string): Promise<User> {
  const { data } = await apiClient<AuthSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
  setSession(data);
  return data.user;
}

/**
 * POST /api/auth/logout (always 200 per contract), then drop the in-memory session regardless,
 * plus the kid player's offline media, library and sounds caches and its queue of unsent plays.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient<null>("/api/auth/logout", { method: "POST" });
  } catch {
    // The local session is cleared either way; a dead API must not trap the user signed in.
  } finally {
    setSession(null);
    clearPlayQueue();
    await clearOfflineCaches();
  }
}

/**
 * Accepts only same-origin relative paths ("/studio/children?x=1"); anything else
 * (absolute URLs, protocol-relative "//evil.com", backslash tricks) falls back.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/studio"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (!isBrowser) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Full-page redirect to /login, remembering where the user was. Browser only. */
export function redirectToLogin(): void {
  if (!isBrowser || window.location.pathname === "/login") return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}
