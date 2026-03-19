export const BUDGET_PERIODS = ["monthly", "weekly", "yearly"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  yearly: "Yearly",
};

export const BUDGET_THRESHOLDS = {
  WARNING: 80,
  EXCEEDED: 100,
} as const;
