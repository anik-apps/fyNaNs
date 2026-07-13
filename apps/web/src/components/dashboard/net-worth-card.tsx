"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import { Expand, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { ChartModal } from "./chart-modal";
import type { NetWorthPoint } from "./nw-chart";

const NWChart = dynamic(() => import("./nw-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

interface NetWorthCardProps {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
}

const PERIODS = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "all", label: "All" },
];

export const DEFAULT_NET_WORTH_PERIOD = "1m";

export function netWorthHistoryQueryOptions(period: string) {
  return {
    queryKey: ["net-worth-history", period],
    queryFn: () =>
      apiFetch<{ points: NetWorthPoint[] }>(
        `/api/dashboard/net-worth-history?period=${period}`
      ),
  };
}

export function NetWorthCard({
  totalAssets,
  totalLiabilities,
  netWorth,
}: NetWorthCardProps) {
  const nw = parseFloat(netWorth);
  const isPositive = nw > 0;
  const isZero = nw === 0;

  const [period, setPeriod] = useState(DEFAULT_NET_WORTH_PERIOD);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    data: history,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(netWorthHistoryQueryOptions(period));
  const chartData = history?.points ?? [];

  const periodButtons = (
    <div className="flex gap-0.5">
      {PERIODS.map((p) => (
        <Button
          key={p.value}
          variant={period === p.value ? "default" : "ghost"}
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setPeriod(p.value)}
        >
          {p.label}
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
              Net Worth
            </CardTitle>
            <div className="flex items-center gap-1">
              {periodButtons}
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
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-3xl font-bold",
                isPositive ? "text-green-600 dark:text-green-400" : isZero ? "" : "text-red-600 dark:text-red-400"
              )}
            >
              {formatCurrency(netWorth)}
            </span>
            {isPositive ? (
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : isZero ? (
              <Minus className="h-5 w-5 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
          </div>

          {chartData.length > 1 && !isPending && (
            <div
              className="h-32 -mx-2 cursor-pointer"
              onClick={() => setModalOpen(true)}
            >
              <NWChart data={chartData} period={period} height="100%" />
            </div>
          )}
          {isPending && (
            <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
              Loading chart...
            </div>
          )}
          {isError && (
            <div className="h-32 flex items-center justify-center">
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

          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Assets</span>
              <p className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(totalAssets)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Liabilities</span>
              <p className="font-medium text-red-600 dark:text-red-400">
                {formatCurrency(totalLiabilities)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChartModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Net Worth History"
      >
        <div className="flex flex-col h-full gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-2xl font-bold",
                isPositive ? "text-green-600 dark:text-green-400" : isZero ? "" : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrency(netWorth)}
              </span>
            </div>
            {periodButtons}
          </div>
          <div className="flex-1 min-h-0">
            {chartData.length > 1 ? (
              <NWChart data={chartData} period={period} height="100%" showGrid />
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
