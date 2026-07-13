"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CardActionsMenu } from "@/components/shared/card-actions-menu";
import { BudgetForm } from "./budget-form";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";
import type { Budget } from "./types";

interface BudgetProgressProps {
  budget: Budget;
}

export function BudgetProgress({ budget }: BudgetProgressProps) {
  const { category_name, amount_limit, current_spend, period } = budget;
  const categoryName = category_name ?? "Uncategorized";

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/budgets/${budget.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteOpen(false);
    },
  });

  // GET /api/budgets returns current_spend (not percent_spent) — derive it.
  const limit = parseFloat(amount_limit);
  const spent = parseFloat(current_spend);
  const percentSpent = limit > 0 ? (spent / limit) * 100 : 0;
  const remaining = limit - spent;
  const isOverBudget = percentSpent > 100;

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{categoryName}</h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground capitalize">
              {period}
            </span>
            <CardActionsMenu
              label={`Actions for ${categoryName} budget`}
              onEdit={() => setEditOpen(true)}
              deleteTitle={`Delete budget for "${categoryName}"?`}
              deleteDescription="This removes the budget permanently."
              deleteOpen={deleteOpen}
              onDeleteOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) deleteMutation.reset();
              }}
              onConfirmDelete={() => deleteMutation.mutate()}
              isDeleting={deleteMutation.isPending}
              deleteError={
                deleteMutation.error
                  ? deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : "Failed to delete budget"
                  : null
              }
            />
          </div>
        </div>

        <Progress
          value={Math.min(percentSpent, 100)}
          className={cn(
            "h-3",
            isOverBudget
              ? "[&>div]:bg-red-500"
              : percentSpent >= 80
                ? "[&>div]:bg-yellow-500"
                : "[&>div]:bg-green-500"
          )}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatCurrency(current_spend)} / {formatCurrency(amount_limit)}
          </span>
          <span
            className={cn(
              "font-medium",
              isOverBudget ? "text-red-600" : "text-green-600"
            )}
          >
            {isOverBudget
              ? `${formatCurrency(Math.abs(remaining))} over`
              : `${formatCurrency(remaining)} left`}
          </span>
        </div>

        <div className="text-xs text-muted-foreground text-right">
          {Math.round(percentSpent)}% used
        </div>
      </CardContent>
      {editOpen && (
        <BudgetForm
          editing={budget}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </Card>
  );
}
