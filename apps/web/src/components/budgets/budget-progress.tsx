"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, cn } from "@/lib/utils";

interface BudgetProgressProps {
  id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  amount_limit: string;
  amount_spent: string;
  percent_spent: number;
  period: string;
}

export function BudgetProgress({
  category_name,
  amount_limit,
  amount_spent,
  percent_spent,
  period,
}: BudgetProgressProps) {
  const remaining = parseFloat(amount_limit) - parseFloat(amount_spent);
  const isOverBudget = percent_spent > 100;

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{category_name}</h3>
          <span className="text-xs text-muted-foreground capitalize">
            {period}
          </span>
        </div>

        <Progress
          value={Math.min(percent_spent, 100)}
          className={cn(
            "h-3",
            isOverBudget
              ? "[&>div]:bg-red-500"
              : percent_spent >= 80
                ? "[&>div]:bg-yellow-500"
                : "[&>div]:bg-green-500"
          )}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatCurrency(amount_spent)} / {formatCurrency(amount_limit)}
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
          {Math.round(percent_spent)}% used
        </div>
      </CardContent>
    </Card>
  );
}
