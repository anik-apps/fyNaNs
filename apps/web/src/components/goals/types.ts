import type { GoalStatus, PaceStatus } from "@fynans/shared-types";

export interface LinkedAccountSummary {
  id: string;
  name: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: string;
  target_date: string | null;
  linked_account: LinkedAccountSummary | null;
  status: GoalStatus;
  current_amount: string;
  progress_pct: number;
  required_monthly: string | null;
  pace_status: PaceStatus | null;
  completed_at: string | null;
  celebrated_at: string | null;
}

export interface Contribution {
  id: string;
  contribution_date: string;
  amount: string;
  note: string | null;
  created_at: string;
}

export interface SavingsGoalDetail extends SavingsGoal {
  contributions: Contribution[];
  notes: string | null;
}

export function money(v: string | number): string {
  return Number(v).toFixed(2);
}
