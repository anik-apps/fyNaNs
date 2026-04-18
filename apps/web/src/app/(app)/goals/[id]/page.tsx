"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useConfetti } from "@/hooks/use-confetti";
import { Button } from "@/components/ui/button";
import { GoalForm } from "@/components/goals/goal-form";
import { ReopenDialog } from "@/components/goals/reopen-dialog";
import { ContributionsPanel } from "@/components/goals/contributions-panel";
import { money, type SavingsGoalDetail } from "@/components/goals/types";

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [goal, setGoal] = useState<SavingsGoalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fireConfetti = useConfetti();

  const reload = useCallback(async () => {
    try {
      const g = await apiFetch<SavingsGoalDetail>(`/api/goals/${id}`);
      setGoal(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (goal?.status === "completed" && goal.celebrated_at === null) {
      fireConfetti();
    }
  }, [goal?.id, goal?.status, goal?.celebrated_at, fireConfetti]);

  if (error) return <div className="text-destructive">Error: {error}</div>;
  if (!goal) return <div className="text-muted-foreground">Loading…</div>;

  const isCelebration = goal.status === "completed" && goal.celebrated_at === null;
  const canAddContributions = goal.linked_account === null && goal.status === "active";

  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:underline">← Back</button>

      <div
        className={
          "rounded-lg border p-5 " +
          (isCelebration
            ? "border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 dark:border-amber-800 dark:from-amber-950/30 dark:to-yellow-950/30"
            : "border-border bg-card")
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{goal.name}</h1>
            {goal.linked_account && (
              <div className="text-sm text-muted-foreground">Linked · {goal.linked_account.name}</div>
            )}
          </div>
          <div className="flex gap-2">
            <GoalForm editing={goal} onSaved={reload} trigger={<Button variant="outline">Edit</Button>} />
            {goal.status === "completed" && (
              <ReopenDialog goalId={goal.id} currentAmount={goal.current_amount} onDone={reload} />
            )}
          </div>
        </div>

        <div className="mt-3 text-3xl font-semibold">
          ${money(goal.current_amount)}
          <span className="ml-2 text-base font-normal text-muted-foreground">of ${money(goal.target_amount)}</span>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, goal.progress_pct)}%` }} />
        </div>

        {isCelebration && (
          <div className="mt-4">
            <Button
              onClick={async () => {
                await apiFetch(`/api/goals/${goal.id}/acknowledge`, { method: "POST" });
                await reload();
              }}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Acknowledge
            </Button>
          </div>
        )}

        {goal.status === "active" && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await apiFetch(`/api/goals/${goal.id}/archive`, { method: "POST" });
                await reload();
              }}
            >
              Archive
            </Button>
          </div>
        )}
      </div>

      {canAddContributions && (
        <ContributionsPanel
          goalId={goal.id}
          contributions={goal.contributions}
          onChanged={reload}
        />
      )}

      {goal.notes && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Notes</div>
          <div className="whitespace-pre-wrap text-sm">{goal.notes}</div>
        </div>
      )}
    </div>
  );
}
