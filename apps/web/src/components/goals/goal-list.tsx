"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalCard } from "./goal-card";
import type { SavingsGoal } from "./types";

export function GoalList({ refreshKey }: { refreshKey: number }) {
  const [active, setActive] = useState<SavingsGoal[] | null>(null);
  const [completed, setCompleted] = useState<SavingsGoal[] | null>(null);
  const [archived, setArchived] = useState<SavingsGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      apiFetch<SavingsGoal[]>("/api/goals?status=active"),
      apiFetch<SavingsGoal[]>("/api/goals?status=completed"),
      apiFetch<SavingsGoal[]>("/api/goals?status=archived"),
    ])
      .then(([a, c, ar]) => {
        if (cancel) return;
        setActive(a); setCompleted(c); setArchived(ar);
      })
      .catch((e) => !cancel && setError(String(e)));
    return () => { cancel = true; };
  }, [refreshKey]);

  if (error) return <div className="text-destructive">Error: {error}</div>;
  if (active === null) return <div className="text-muted-foreground">Loading…</div>;

  const none = active.length === 0 && (completed?.length ?? 0) === 0 && (archived?.length ?? 0) === 0;
  if (none) {
    return (
      <EmptyState
        icon={Target}
        title="No goals yet"
        description="Create your first savings goal to track progress toward a target."
      />
    );
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <Section title="Active">
          {active.map((g) => <GoalCard key={g.id} goal={g} />)}
        </Section>
      )}
      {(completed?.length ?? 0) > 0 && (
        <Section title="Completed">
          {completed!.map((g) => <GoalCard key={g.id} goal={g} />)}
        </Section>
      )}
      {(archived?.length ?? 0) > 0 && (
        <details className="pt-2">
          <summary className="cursor-pointer font-semibold text-foreground">
            Archived ({archived!.length})
          </summary>
          <div className="mt-3 space-y-3">
            {archived!.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
