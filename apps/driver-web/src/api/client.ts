import { clearSession, getAccessToken, getRefreshToken, setSession } from "../session";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch("/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    return false;
  }

  const body = await res.json();
  setSession(body.accessToken, body.refreshToken);
  return true;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  async function doFetch(): Promise<Response> {
    const headers: Record<string, string> = {};
    // Only send Content-Type: application/json when there's actually a body
    // — Fastify's default JSON parser throws FST_ERR_CTP_EMPTY_JSON_BODY on
    // an empty body with that header set (e.g. POST /submit, /pause, /archive
    // take no body), which this app's error handler was turning into a
    // generic 500 instead of the real 400.
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  let res = await doFetch();

  // A 401 on an authenticated request gets exactly one refresh-and-retry —
  // covers the access token simply having expired (normal, not an attack).
  if (res.status === 401 && auth) {
    refreshInFlight ??= tryRefresh().finally(() => {
      refreshInFlight = null;
    });
    const refreshed = await refreshInFlight;
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = `Request failed (${res.status})`;
    let details: unknown;
    try {
      const body = await res.json();
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // non-JSON error body — fall back to the generic message above
    }
    if (res.status === 401) clearSession();
    throw new ApiError(res.status, code, message, details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
