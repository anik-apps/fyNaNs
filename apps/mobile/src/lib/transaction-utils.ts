export const INCOME_CATEGORIES = new Set([
  "Income",
  "Salary",
  "Freelance",
  "Other Income",
  "Investments",
]);

export const TRANSFER_CATEGORIES = new Set(["Transfer"]);

/**
 * Determine how to display a transaction amount.
 *
 * Plaid uses a unified sign convention for ALL account types:
 *   - Positive = money out (expense)
 *   - Negative = money in (income)
 *
 * Category overrides take precedence:
 *   - Income categories always show as income
 *   - Transfer categories always show as neutral
 *   - Otherwise, fall back to the sign of the amount
 */
export function getDisplayType(
  amount: number,
  categoryName: string,
): "income" | "expense" | "transfer" {
  if (TRANSFER_CATEGORIES.has(categoryName)) return "transfer";
  if (INCOME_CATEGORIES.has(categoryName)) return "income";
  return amount < 0 ? "income" : "expense";
}
