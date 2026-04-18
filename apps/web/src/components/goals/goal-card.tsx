"use client";

import Link from "next/link";
import type { PaceStatus } from "@fynans/shared-types";
import type { SavingsGoal } from "./types";
import { money } from "./types";

const PACE_CLASS: Record<PaceStatus, string> = {
  ahead: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  on_pace: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  behind: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  target_passed: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
};

const PACE_LABEL: Record<PaceStatus, string> = {
  ahead: "Ahead",
  on_pace: "On pace",
  behind: "Behind",
  target_passed: "Target passed",
};

export function GoalCard({ goal }: { goal: SavingsGoal }) {
  const isCelebration =
    goal.status === "completed" && goal.celebrated_at === null;

  return (
    <Link
      href={`/goals/${goal.id}`}
      data-testid={`goal-card-${goal.id}`}
      className={
        "block rounded-lg border p-4 transition hover:shadow-sm " +
        (isCelebration
          ? "border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 dark:border-amber-800 dark:from-amber-950/30 dark:to-yellow-950/30"
          : "border-border bg-card")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{goal.name}</h3>
            {isCelebration && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                🎉 REACHED
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {goal.linked_account ? `Linked · ${goal.linked_account.name}` : "Manual"}
            {goal.target_date ? ` · Target ${goal.target_date}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">
            ${money(goal.current_amount)} / ${money(goal.target_amount)}
          </div>
          <div className="text-xs text-muted-foreground">{goal.progress_pct}%</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, goal.progress_pct)}%` }}
        />
      </div>
      {goal.pace_status && (
        <div className={"mt-2 inline-block rounded-full border px-2 py-0.5 text-xs " + PACE_CLASS[goal.pace_status]}>
          {PACE_LABEL[goal.pace_status]}
          {goal.required_monthly !== null
            ? ` · $${Number(goal.required_monthly).toFixed(0)}/mo needed`
            : ""}
        </div>
      )}
    </Link>
  );
}
