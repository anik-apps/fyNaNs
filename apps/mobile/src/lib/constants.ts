// Base URL for API calls.
// On mobile, we need the full URL since there's no same-origin proxy.
// Default to localhost:8888 for dev; override via EXPO_PUBLIC_API_URL env var.
// 10.0.2.2 is Android emulator's alias for host machine localhost
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8888";

export const ROUTES = {
  LOGIN: "/(auth)/login",
  REGISTER: "/(auth)/register",
  FORGOT_PASSWORD: "/(auth)/forgot-password",
  MFA: "/(auth)/mfa",
  TABS: "/(tabs)",
  DASHBOARD: "/(tabs)",
  ACCOUNTS: "/(tabs)/accounts",
  TRANSACTIONS: "/(tabs)/transactions",
  BUDGETS: "/(tabs)/budgets",
  BILLS: "/(tabs)/bills",
  SETTINGS: "/(tabs)/settings",
} as const;
