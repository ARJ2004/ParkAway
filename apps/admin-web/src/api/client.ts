import { clearSession, getAccessToken, getRefreshToken, updateTokens } from "../session";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch("/v1/admin/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    return false;
  }

  const body = await res.json();
  updateTokens(body.accessToken, body.refreshToken);
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
    // an empty body with that header set, which the backend's error handler
    // was turning into a generic 500 instead of the real 400.
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  let res = await doFetch();

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
    try {
      const body = await res.json();
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // non-JSON error body — fall back to the generic message above
    }
    if (res.status === 401) clearSession();
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
