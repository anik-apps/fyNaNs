import React, { createContext, useCallback, useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import {
  getRefreshToken,
  setRefreshToken as storeRefreshToken,
  deleteRefreshToken,
  getDeviceInfo,
} from "@/src/lib/auth-storage";
import { API_URL } from "@/src/lib/constants";
import { setAccessToken as setApiAccessToken } from "@/src/lib/api-client";
import { queryClient } from "@/src/lib/query-client";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  has_mfa: boolean;
  is_dev: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  accessToken: string | null;
  login: (
    email: string,
    password: string
  ) => Promise<{ requires_mfa?: boolean; mfa_token?: string }>;
  register: (name: string, email: string, password: string) => Promise<void>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  loginWithOAuth: (provider: string, idToken: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  function updateAccessToken(token: string | null) {
    setAccessToken(token);
    setApiAccessToken(token);
  }

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const storedToken = await getRefreshToken();
      if (!storedToken) return false;

      const deviceInfo = await getDeviceInfo();
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: storedToken,
          device_info: deviceInfo,
        }),
      });

      if (!response.ok) {
        await deleteRefreshToken();
        return false;
      }

      const data = await response.json();
      updateAccessToken(data.access_token);
      setUser(data.user);

      if (data.refresh_token) {
        await storeRefreshToken(data.refresh_token);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    refreshAuth().finally(() => setIsLoading(false));
  }, [refreshAuth]);

  // Protect routes
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, segments, isLoading]);

  const login = useCallback(
    async (email: string, password: string) => {
      const deviceInfo = await getDeviceInfo();
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, device_info: deviceInfo }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();

      if (data.requires_mfa) {
        return { requires_mfa: true, mfa_token: data.mfa_token };
      }

      // Drop any cached data from a previous session before this user's
      // queries start populating the cache.
      queryClient.clear();
      updateAccessToken(data.access_token);
      setUser(data.user);
      await storeRefreshToken(data.refresh_token);
      return {};
    },
    []
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const deviceInfo = await getDeviceInfo();
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, device_info: deviceInfo }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Registration failed");
      }

      const data = await response.json();
      queryClient.clear();
      updateAccessToken(data.access_token);
      setUser(data.user);
      await storeRefreshToken(data.refresh_token);
    },
    []
  );

  const verifyMfa = useCallback(
    async (mfaToken: string, code: string) => {
      const deviceInfo = await getDeviceInfo();
      const response = await fetch(`${API_URL}/api/auth/mfa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mfa_token: mfaToken,
          code,
          device_info: deviceInfo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Invalid MFA code");
      }

      const data = await response.json();
      queryClient.clear();
      updateAccessToken(data.access_token);
      setUser(data.user);
      await storeRefreshToken(data.refresh_token);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      try {
        const storedToken = await getRefreshToken();
        if (storedToken && accessToken) {
          await fetch(`${API_URL}/api/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ refresh_token: storedToken }),
          });
        }
      } catch {
        // Proceed with local cleanup even if server request fails
      }
      // Clear Google sign-in session (no-op if user didn't sign in via Google)
      try { await GoogleSignin.signOut(); } catch {}
      await deleteRefreshToken();
    } finally {
      // Always drop the local session: even if cleanup above rejects, logout
      // must never leave the token/user usable (e.g. behind the app lock).
      updateAccessToken(null);
      setUser(null);
      // Evict cached financial data so a later login (within gcTime) can't
      // see the previous user's queries.
      queryClient.clear();
    }
  }, [accessToken]);

  const loginWithOAuth = useCallback(async (provider: string, idToken: string) => {
    const deviceInfo = await getDeviceInfo();
    const response = await fetch(`${API_URL}/api/auth/oauth/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken, device_info: deviceInfo }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "OAuth login failed" }));
      throw new Error(error.detail || "OAuth login failed");
    }

    const data = await response.json();
    queryClient.clear();
    updateAccessToken(data.access_token);
    setUser(data.user);
    if (data.refresh_token) {
      await storeRefreshToken(data.refresh_token);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        accessToken,
        login,
        register,
        verifyMfa,
        logout,
        refreshAuth,
        loginWithOAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
