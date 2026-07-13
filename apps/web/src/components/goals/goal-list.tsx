"use client";

import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalCard } from "./goal-card";
import type { SavingsGoal } from "./types";

function useGoals(status: "active" | "completed" | "archived") {
  return useQuery({
    queryKey: ["goals", status],
    queryFn: () => apiFetch<SavingsGoal[]>(`/api/goals?status=${status}`),
  });
}

export function GoalList() {
  const activeQuery = useGoals("active");
  const completedQuery = useGoals("completed");
  const archivedQuery = useGoals("archived");

  const error =
    activeQuery.error ?? completedQuery.error ?? archivedQuery.error;
  if (error) return <div className="text-destructive">Error: {String(error)}</div>;

  // Wait for all three statuses (the pre-query-cache version used Promise.all)
  // so the empty state never flashes while completed/archived are in flight.
  const active = activeQuery.data;
  const completed = completedQuery.data;
  const archived = archivedQuery.data;
  if (active === undefined || completed === undefined || archived === undefined)
    return <div className="text-muted-foreground">Loading…</div>;

  const none = active.length === 0 && completed.length === 0 && archived.length === 0;
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
      {completed.length > 0 && (
        <Section title="Completed">
          {completed.map((g) => <GoalCard key={g.id} goal={g} />)}
        </Section>
      )}
      {archived.length > 0 && (
        <details className="pt-2">
          <summary className="cursor-pointer font-semibold text-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-3 space-y-3">
            {archived.map((g) => <GoalCard key={g.id} goal={g} />)}
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
