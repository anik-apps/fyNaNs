import { API_URL } from "./constants";
import {
  getRefreshToken,
  setRefreshToken,
  deleteRefreshToken,
  getDeviceInfo,
} from "./auth-storage";

/**
 * Error thrown by apiFetch for non-ok responses. Carries the HTTP status so
 * callers (e.g. the React Query retry predicate) can distinguish 4xx from 5xx.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const storedToken = await getRefreshToken();
    if (!storedToken) return false;

    const deviceInfo = await getDeviceInfo();
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: storedToken,
        device_info: deviceInfo,
      }),
    });

    if (!res.ok) {
      await deleteRefreshToken();
      return false;
    }

    const data = await res.json();
    accessToken = data.access_token;
    if (data.refresh_token) {
      await setRefreshToken(data.refresh_token);
    }
    return true;
  } catch {
    return false;
  }
}

async function getValidToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token && !isTokenExpired(token)) return token;

  if (!refreshPromise) {
    refreshPromise = attemptRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  const success = await refreshPromise;
  return success ? getAccessToken() : null;
}

/**
 * Convert a FastAPI error `detail` into a human-readable message. Plain
 * errors use a string detail; 422 validation errors use an array of
 * `{ msg, loc, ... }` objects, which would otherwise stringify as
 * "[object Object]" in user-facing alerts.
 */
function formatErrorDetail(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => (typeof item?.msg === "string" ? item.msg : null))
      .filter((msg): msg is string => Boolean(msg));
    if (msgs.length > 0) return msgs.join("; ");
  }
  return `API error: ${status}`;
}

/**
 * Authenticated fetch wrapper for mobile API calls.
 * Handles token management, refresh, and retry on 401.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const token = await getValidToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // If 401, force refresh and retry once
  if (response.status === 401) {
    if (!refreshPromise) {
      refreshPromise = attemptRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const success = await refreshPromise;
    if (success) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
      });
    } else {
      accessToken = null;
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(
      formatErrorDetail(error?.detail, response.status),
      response.status
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
