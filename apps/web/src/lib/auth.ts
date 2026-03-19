import { API_URL } from "./constants";
import { setAccessToken } from "./api-client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  has_mfa: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export async function login(
  credentials: LoginCredentials
): Promise<{ user: AuthUser; requires_mfa?: boolean; mfa_token?: string }> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Login failed");
  }

  const data = await response.json();

  if (data.requires_mfa) {
    return { user: data.user, requires_mfa: true, mfa_token: data.mfa_token };
  }

  setAccessToken(data.access_token);
  return { user: data.user };
}

export async function register(
  data: RegisterData
): Promise<{ user: AuthUser }> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Registration failed");
  }

  const result = await response.json();
  setAccessToken(result.access_token);
  return { user: result.user };
}

export async function verifyMfa(
  mfaToken: string,
  code: string
): Promise<{ user: AuthUser }> {
  const response = await fetch(`${API_URL}/api/auth/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mfa_token: mfaToken, code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Invalid MFA code");
  }

  const data = await response.json();
  setAccessToken(data.access_token);
  return { user: data.user };
}

export async function oauthLogin(
  provider: "google" | "apple",
  token: string
): Promise<{ user: AuthUser }> {
  const response = await fetch(`${API_URL}/api/auth/oauth/${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "OAuth login failed");
  }

  const data = await response.json();
  setAccessToken(data.access_token);
  return { user: data.user };
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  setAccessToken(null);
}

export async function refreshSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) return null;

    const data = await response.json();
    setAccessToken(data.access_token);
    return data.user;
  } catch {
    return null;
  }
}
