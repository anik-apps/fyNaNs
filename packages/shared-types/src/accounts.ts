export const ACCOUNT_TYPES = ["checking", "savings", "credit", "loan", "investment"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ASSET_ACCOUNT_TYPES: readonly AccountType[] = [
  "checking",
  "savings",
  "investment",
] as const;

export const LIABILITY_ACCOUNT_TYPES: readonly AccountType[] = [
  "credit",
  "loan",
] as const;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit Card",
  loan: "Loan",
  investment: "Investment",
};
