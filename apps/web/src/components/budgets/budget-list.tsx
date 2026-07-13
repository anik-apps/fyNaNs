"use client";

import { useQuery } from "@tanstack/react-query";
import { BudgetProgress } from "./budget-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { PieChart } from "lucide-react";
import type { Budget } from "./types";

interface BudgetListProps {
  onCreate?: () => void;
}

export function BudgetList({ onCreate }: BudgetListProps) {
  const { data: budgets, isPending, isError, error, refetch } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => apiFetch<Budget[]>("/api/budgets"),
  });

  if (isPending) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md flex items-center justify-between gap-4">
        <span>
          {error instanceof Error ? error.message : "Failed to load budgets"}
        </span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <PieChart className="mx-auto h-10 w-10 mb-3 opacity-50" />
        <p className="text-lg font-medium">No budgets yet</p>
        <p className="text-sm mt-1">
          Create a budget to start tracking your spending by category.
        </p>
        <Button variant="outline" className="mt-4" onClick={onCreate}>
          Create a budget
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {budgets.map((budget) => (
        <BudgetProgress key={budget.id} budget={budget} />
      ))}
    </div>
  );
}
