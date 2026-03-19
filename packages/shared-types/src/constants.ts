export const NOTIFICATION_TYPES = [
  "budget_80",
  "budget_100",
  "bill_reminder",
  "bill_overdue",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const THEME_OPTIONS = ["light", "dark", "system"] as const;
export type Theme = (typeof THEME_OPTIONS)[number];

export const CURRENCY_DEFAULT = "USD";
export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 200;
