"use client";

import Link from "next/link";
import type { PaceStatus } from "@fynans/shared-types";

export interface GoalDashboardItem {
  id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  progress_pct: number;
  pace_status: PaceStatus | null;
  target_date: string | null;
}

export function GoalsNeedingAttentionCard({
  topGoals,
  activeCount,
}: {
  topGoals: GoalDashboardItem[];
  activeCount: number;
}) {
  if (activeCount === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 font-semibold">Savings Goals</div>
        <div className="text-sm text-zinc-500">No active goals yet.</div>
        <Link href="/goals" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          Set a goal →
        </Link>
      </div>
    );
  }

  const attention = topGoals.filter((g) => g.pace_status === "behind" || g.pace_status === "target_passed");

  if (attention.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-1 font-semibold">Savings Goals</div>
        <div className="text-sm text-green-700">
          ✓ All {activeCount} goal{activeCount === 1 ? "" : "s"} on track
        </div>
        <Link href="/goals" className="mt-2 inline-block text-xs text-zinc-500 hover:underline">
          View all →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">Goals Needing Attention</div>
        <Link href="/goals" className="text-xs text-blue-600 hover:underline">View all →</Link>
      </div>
      <div className="space-y-2">
        {topGoals.map((g) => (
          <Link href={`/goals/${g.id}`} key={g.id} className="block">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{g.name}</span>
              <span className="text-xs text-zinc-500">{g.progress_pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, g.progress_pct)}%` }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
