"use client";

import { useQueryClient } from "@tanstack/react-query";
import { GoalList } from "@/components/goals/goal-list";
import { GoalForm } from "@/components/goals/goal-form";

export default function GoalsPage() {
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savings Goals</h1>
        <GoalForm
          onSaved={() =>
            queryClient.invalidateQueries({ queryKey: ["goals"] })
          }
        />
      </div>
      <GoalList />
    </div>
  );
}
