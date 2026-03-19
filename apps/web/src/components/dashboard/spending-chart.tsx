"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";

interface SpendingChartProps {
  currentMonth: string;
  previousMonth: string;
  difference: string;
  percentChange: number | null;
}

export function SpendingChart({
  currentMonth,
  previousMonth,
  difference,
  percentChange,
}: SpendingChartProps) {
  const diff = parseFloat(difference);
  const isUp = diff > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Spending This Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formatCurrency(currentMonth)}</p>
        <div className="flex items-center gap-1 mt-1 text-sm">
          <span className={cn(isUp ? "text-red-600" : "text-green-600")}>
            {isUp ? "+" : ""}
            {percentChange !== null ? `${percentChange}%` : "N/A"}
          </span>
          <span className="text-muted-foreground">
            vs last month ({formatCurrency(previousMonth)})
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>This month</span>
              <span>{formatCurrency(currentMonth)}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    (parseFloat(currentMonth) /
                      Math.max(
                        parseFloat(currentMonth),
                        parseFloat(previousMonth),
                        1
                      )) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Last month</span>
              <span>{formatCurrency(previousMonth)}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-muted-foreground/30 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    (parseFloat(previousMonth) /
                      Math.max(
                        parseFloat(currentMonth),
                        parseFloat(previousMonth),
                        1
                      )) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
