import { API_URL } from "./constants";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Consider expired if within 30 seconds of expiry
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (refreshResponse.ok) {
    const data = await refreshResponse.json();
    setAccessToken(data.access_token);
    return data.access_token;
  }

  setAccessToken(null);
  return null;
}

async function getValidToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token && !isTokenExpired(token)) return token;

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Authenticated fetch wrapper that handles token management and refresh.
 * Used by client components for API calls.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type for non-FormData bodies
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
    credentials: "include",
  });

  // If 401, try to refresh and retry once
  if (response.status === 401) {
    const newToken = await getValidToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
    } else {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
