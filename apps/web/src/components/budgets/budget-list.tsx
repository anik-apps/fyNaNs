"use client";

import { useEffect, useState } from "react";
import { BudgetProgress } from "./budget-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";

interface Budget {
  id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  amount_limit: string;
  amount_spent: string;
  percent_spent: number;
  period: string;
}

export function BudgetList() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBudgets() {
      try {
        const data = await apiFetch<Budget[]>("/api/budgets");
        setBudgets(data);
      } catch {
        // handled by API client
      } finally {
        setIsLoading(false);
      }
    }
    fetchBudgets();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No budgets yet</p>
        <p className="text-sm mt-1">
          Create a budget to start tracking your spending by category.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {budgets.map((budget) => (
        <BudgetProgress key={budget.id} {...budget} />
      ))}
    </div>
  );
}
