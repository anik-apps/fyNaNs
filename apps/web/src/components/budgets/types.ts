// Shape of BudgetResponse from GET /api/budgets — limited to the fields the
// web UI actually consumes. The API returns current_spend (not amount_spent
// or percent_spent); percent spent is derived client-side.
export interface Budget {
  id: string;
  category_id: string;
  category_name: string | null;
  amount_limit: string;
  period: string;
  current_spend: string;
}
