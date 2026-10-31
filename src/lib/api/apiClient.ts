import { getAccessToken, redirectToLogin, refreshToken } from "@/lib/auth";
import type { ApiResponse, ApiSuccess } from "@/lib/api/types";

/** Thrown for any non-success response; carries the contract's `{ code, message }`. */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function send(endpoint: string, options: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

/**
 * Authenticated transport shared by JSON calls and media downloads.
 * On 401 it refreshes once (singleton) and retries once.
 */
async function authedFetch(endpoint: string, options: RequestInit): Promise<Response> {
  const res = await send(endpoint, options);
  if (res.status !== 401 || endpoint.startsWith("/api/auth/")) return res;
  try {
    await refreshToken();
  } catch {
    // Refresh cookie missing/expired: send the browser to /login (no-op on the server).
    redirectToLogin();
    throw new ApiClientError("UNAUTHORIZED", "Session expired", 401);
  }
  return send(endpoint, options);
}

function toError(res: Response, body: ApiResponse<unknown> | null): ApiClientError {
  return new ApiClientError(
    body?.error?.code ?? "HTTP_ERROR",
    body?.error?.message ?? `API error: ${res.status}`,
    res.status,
  );
}

/**
 * Core fetch wrapper. Every backend call goes through here.
 * Resolves to the checked envelope (`data` present, `error` null) so callers
 * destructure `{ data, meta }`; throws ApiClientError otherwise.
 */
export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<ApiSuccess<T>> {
  const res = await authedFetch(endpoint, options);

  // 204 No Content (e.g. DELETE) has no envelope.
  if (res.status === 204) return { data: null as T, error: null, meta: {} };

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !body || body.error) throw toError(res, body);
  return { data: body.data as T, error: null, meta: body.meta ?? {} };
}

/**
 * Binary download with the same bearer token + refresh path as apiClient.
 * Used for /api/media/* — <audio>/<img> can't send the in-memory token themselves.
 */
export async function apiBlob(endpoint: string): Promise<Blob> {
  const res = await authedFetch(endpoint, {});
  if (!res.ok) throw toError(res, (await res.json().catch(() => null)) as ApiResponse<unknown> | null);
  return res.blob();
}
