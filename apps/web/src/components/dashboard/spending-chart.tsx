"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import { Expand } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { ChartModal } from "./chart-modal";
import type { SpendingPoint } from "./spending-bar-chart";

const SpendingBarChart = dynamic(() => import("./spending-bar-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

interface SpendingChartProps {
  currentMonth: string;
  previousMonth: string;
  difference: string;
  percentChange: number | null;
}

const VIEWS = [
  { value: "monthly", label: "6M" },
  { value: "monthly-12", label: "12M" },
  { value: "yearly", label: "Yearly" },
];

export const DEFAULT_SPENDING_VIEW = "monthly";

export function spendingHistoryQueryOptions(view: string) {
  const isYearly = view === "yearly";
  const months = view === "monthly-12" ? 12 : view === "yearly" ? 60 : 6;
  return {
    queryKey: ["spending-history", view],
    queryFn: () =>
      apiFetch<{ points: SpendingPoint[] }>(
        `/api/dashboard/spending-history?view=${isYearly ? "yearly" : "monthly"}&months=${months}`
      ),
  };
}

export function SpendingChart({
  currentMonth,
  previousMonth,
  difference,
  percentChange,
}: SpendingChartProps) {
  const diff = parseFloat(difference);
  const isUp = diff > 0;

  const [view, setView] = useState(DEFAULT_SPENDING_VIEW);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    data: history,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(spendingHistoryQueryOptions(view));
  const chartData = history?.points ?? [];

  const viewButtons = (
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
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spending & Income
            </CardTitle>
            <div className="flex items-center gap-1">
              {viewButtons}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setModalOpen(true)}
                title="Expand chart"
              >
                <Expand className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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

          {chartData.length > 0 && !isPending && (
            <div
              className="h-40 -mx-2 cursor-pointer"
              onClick={() => setModalOpen(true)}
            >
              <SpendingBarChart data={chartData} height="100%" />
            </div>
          )}
          {isPending && (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
              Loading chart...
            </div>
          )}
          {isError && (
            <div className="h-40 flex items-center justify-center">
              <div className="p-2 text-xs text-destructive bg-destructive/10 rounded-md flex items-center gap-3">
                <span>
                  {error instanceof Error
                    ? error.message
                    : "Failed to load chart"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ChartModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Spending & Income History"
      >
        <div className="flex flex-col h-full gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold">{formatCurrency(currentMonth)}</span>
              <span className="text-sm text-muted-foreground ml-2">this month</span>
            </div>
            {viewButtons}
          </div>
          <div className="flex-1 min-h-0">
            {chartData.length > 0 ? (
              <SpendingBarChart data={chartData} height="100%" showGrid />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No data for this period
              </div>
            )}
          </div>
        </div>
      </ChartModal>
    </>
  );
}
