import { API_URL } from "./constants";
import {
  getRefreshToken,
  setRefreshToken,
  deleteRefreshToken,
  getDeviceInfo,
} from "./auth-storage";

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
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
