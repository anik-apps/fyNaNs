"use client";

import { useState } from "react";
import { GoalList } from "@/components/goals/goal-list";
import { GoalForm } from "@/components/goals/goal-form";

export default function GoalsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savings Goals</h1>
        <GoalForm onSaved={() => setRefreshKey((k) => k + 1)} />
      </div>
      <GoalList refreshKey={refreshKey} />
    </div>
  );
}
