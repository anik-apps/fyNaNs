import { setAccessToken, apiFetch } from "./api-client";

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
): Promise<{ user: AuthUser | null; requires_mfa?: boolean; mfa_token?: string }> {
  const response = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: undefined }));
    throw new Error(error.detail || "Login failed");
  }

  const data = await response.json();

  if (data.mfa_required) {
    return { user: null, requires_mfa: true, mfa_token: data.access_token };
  }

  setAccessToken(data.access_token);

  // Fetch user profile after login
  const user = await fetchProfile();
  return { user };
}

async function fetchProfile(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/user/profile");
}

export async function register(
  data: RegisterData
): Promise<{ user: AuthUser }> {
  // Step 1: Register the user
  const regResponse = await fetch(`/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!regResponse.ok) {
    const error = await regResponse.json().catch(() => ({ detail: undefined }));
    throw new Error(error.detail || "Registration failed");
  }

  // Step 2: Auto-login after registration
  const loginResult = await login({ email: data.email, password: data.password });
  return { user: loginResult.user! };
}

export async function verifyMfa(
  mfaToken: string,
  code: string
): Promise<{ user: AuthUser }> {
  const response = await fetch(`/api/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${mfaToken}`,
    },
    credentials: "include",
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: undefined }));
    throw new Error(error.detail || "Invalid MFA code");
  }

  const data = await response.json();
  setAccessToken(data.access_token);
  const user = await fetchProfile();
  return { user };
}

export async function oauthLogin(
  provider: "google" | "apple",
  token: string
): Promise<{ user: AuthUser }> {
  const response = await fetch(`/api/auth/oauth/${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id_token: token }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: undefined }));
    throw new Error(error.detail || "OAuth login failed");
  }

  const data = await response.json();
  setAccessToken(data.access_token);
  const user = await fetchProfile();
  return { user };
}

export async function logout(): Promise<void> {
  await fetch(`/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  setAccessToken(null);
}

export async function refreshSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) return null;

    const data = await response.json();
    setAccessToken(data.access_token);
    return fetchProfile();
  } catch {
    return null;
  }
}
