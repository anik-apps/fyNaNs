"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  type AuthUser,
  type LoginCredentials,
  type RegisterData,
  login as loginFn,
  register as registerFn,
  logout as logoutFn,
  refreshSession,
  verifyMfa,
  oauthLogin,
} from "@/lib/auth";
import { ROUTES } from "@/lib/constants";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (
    credentials: LoginCredentials
  ) => Promise<{ requires_mfa?: boolean; mfa_token?: string }>;
  register: (data: RegisterData) => Promise<void>;
  loginWithOAuth: (
    provider: "google" | "apple",
    token: string
  ) => Promise<void>;
  verifyMfaCode: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  ROUTES.MFA,
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Try to restore session on mount
  useEffect(() => {
    async function init() {
      const restoredUser = await refreshSession();
      setUser(restoredUser);
      setIsLoading(false);
    }
    init();
  }, []);

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (!user && !isPublicRoute) {
      router.push(ROUTES.LOGIN);
    } else if (user && isPublicRoute && pathname !== ROUTES.MFA) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [user, isLoading, pathname, router]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await loginFn(credentials);
    if (!result.requires_mfa && result.user) {
      setUser(result.user);
      router.push(ROUTES.DASHBOARD);
    }
    return {
      requires_mfa: result.requires_mfa,
      mfa_token: result.mfa_token,
    };
  }, [router]);

  const register = useCallback(async (data: RegisterData) => {
    const result = await registerFn(data);
    setUser(result.user);
    router.push(ROUTES.DASHBOARD);
  }, [router]);

  const loginWithOAuth = useCallback(
    async (provider: "google" | "apple", token: string) => {
      const result = await oauthLogin(provider, token);
      setUser(result.user);
    },
    []
  );

  const verifyMfaCode = useCallback(
    async (mfaToken: string, code: string) => {
      const result = await verifyMfa(mfaToken, code);
      setUser(result.user);
      router.push(ROUTES.DASHBOARD);
    },
    [router]
  );

  const logout = useCallback(async () => {
    await logoutFn();
    setUser(null);
    router.push(ROUTES.LOGIN);
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        loginWithOAuth,
        verifyMfaCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
