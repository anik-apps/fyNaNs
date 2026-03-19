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

// Base URL for API calls.
// In development, Next.js rewrites proxy /api/* to the backend (same-origin, cookies work).
// In production, Caddy routes /api/* to FastAPI (also same-origin).
// So this should be empty — all API calls use relative paths like /api/auth/login.
export const API_URL = "";

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
