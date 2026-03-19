"use client";

import { useState } from "react";
import { BudgetList } from "@/components/budgets/budget-list";
import { BudgetForm } from "@/components/budgets/budget-form";

export default function BudgetsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <BudgetForm onBudgetCreated={() => setRefreshKey((k) => k + 1)} />
      </div>
      <BudgetList key={refreshKey} />
    </div>
  );
}
