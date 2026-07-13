"use client";

import { useState } from "react";
import { BudgetList } from "@/components/budgets/budget-list";
import { BudgetForm } from "@/components/budgets/budget-form";

export default function BudgetsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <BudgetForm open={createOpen} onOpenChange={setCreateOpen} />
      </div>
      <BudgetList onCreate={() => setCreateOpen(true)} />
    </div>
  );
}
