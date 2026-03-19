"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

interface BudgetItem {
  id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  amount_limit: string;
  amount_spent: string;
  percent_spent: number;
}

interface BudgetBarsProps {
  budgets: BudgetItem[];
}

export function BudgetBars({ budgets }: BudgetBarsProps) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Budgets
        </CardTitle>
        <Link
          href={ROUTES.BUDGETS}
          className="text-xs text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No budgets set up yet
          </p>
        ) : (
          budgets.map((budget) => (
            <div key={budget.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{budget.category_name}</span>
                <span className="text-muted-foreground">
                  {formatCurrency(budget.amount_spent)} /{" "}
                  {formatCurrency(budget.amount_limit)}
                </span>
              </div>
              <Progress
                value={Math.min(budget.percent_spent, 100)}
                className={cn(
                  "h-2",
                  budget.percent_spent >= 100
                    ? "[&>div]:bg-red-500"
                    : budget.percent_spent >= 80
                      ? "[&>div]:bg-yellow-500"
                      : "[&>div]:bg-green-500"
                )}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
