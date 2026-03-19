export const ROUTES = {
  // Auth
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  MFA: "/mfa",

  // App
  DASHBOARD: "/dashboard",
  ACCOUNTS: "/accounts",
  TRANSACTIONS: "/transactions",
  BUDGETS: "/budgets",
  BILLS: "/bills",
  SETTINGS: "/settings",
  SETTINGS_PROFILE: "/settings/profile",
  SETTINGS_SECURITY: "/settings/security",
  SETTINGS_NOTIFICATIONS: "/settings/notifications",
} as const;

// Base URL for the API server. Should NOT include /api — all paths include it.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888";

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
