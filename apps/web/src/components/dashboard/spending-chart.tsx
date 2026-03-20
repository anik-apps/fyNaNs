"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface SpendingChartProps {
  currentMonth: string;
  previousMonth: string;
  difference: string;
  percentChange: number | null;
}

interface SpendingPoint {
  label: string;
  spending: number;
  income: number;
}

const VIEWS = [
  { value: "monthly", label: "Monthly", months: 6 },
  { value: "monthly-12", label: "12M", months: 12 },
  { value: "yearly", label: "Yearly", months: 60 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-popover border rounded-md px-3 py-2 shadow-md text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function SpendingChart({
  currentMonth,
  previousMonth,
  difference,
  percentChange,
}: SpendingChartProps) {
  const diff = parseFloat(difference);
  const isUp = diff > 0;

  const [view, setView] = useState("monthly");
  const [chartData, setChartData] = useState<SpendingPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async (v: string) => {
    setIsLoading(true);
    try {
      const isYearly = v === "yearly";
      const months = v === "monthly-12" ? 12 : v === "yearly" ? 60 : 6;
      const data = await apiFetch<{ points: SpendingPoint[] }>(
        `/api/dashboard/spending-history?view=${isYearly ? "yearly" : "monthly"}&months=${months}`
      );
      setChartData(data.points);
    } catch {
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(view);
  }, [view, fetchHistory]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Spending & Income
          </CardTitle>
          <div className="flex gap-0.5">
            {VIEWS.map((v) => (
              <Button
                key={v.value}
                variant={view === v.value ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setView(v.value)}
              >
                {v.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current month summary */}
        <div>
          <p className="text-2xl font-bold">{formatCurrency(currentMonth)}</p>
          <div className="flex items-center gap-1 text-sm">
            <span className={cn(isUp ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
              {isUp ? "+" : ""}
              {percentChange !== null ? `${percentChange}%` : "N/A"}
            </span>
            <span className="text-muted-foreground">
              vs last month ({formatCurrency(previousMonth)})
            </span>
          </div>
        </div>

        {/* Bar Chart */}
        {chartData.length > 0 && !isLoading && (
          <div className="h-40 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  hide
                  domain={[0, "auto"]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: "10px" }}
                />
                <Bar
                  dataKey="spending"
                  name="Spending"
                  fill="#ef4444"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#22c55e"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {isLoading && (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            Loading chart...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
