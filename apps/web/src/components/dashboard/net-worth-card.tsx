"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface NetWorthCardProps {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
}

interface NetWorthPoint {
  date: string;
  net_worth: number;
}

const PERIODS = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "all", label: "All" },
];

function formatDateLabel(dateStr: string, period: string): string {
  const d = new Date(dateStr);
  if (period === "1m" || period === "3m") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload?.[0]) {
    const point = payload[0].payload;
    return (
      <div className="bg-popover border rounded-md px-3 py-2 shadow-md text-sm">
        <p className="text-muted-foreground">{new Date(point.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        <p className="font-semibold">{formatCurrency(point.net_worth)}</p>
      </div>
    );
  }
  return null;
}

export function NetWorthCard({
  totalAssets,
  totalLiabilities,
  netWorth,
}: NetWorthCardProps) {
  const nw = parseFloat(netWorth);
  const isPositive = nw > 0;
  const isZero = nw === 0;

  const [period, setPeriod] = useState("1m");
  const [chartData, setChartData] = useState<NetWorthPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async (p: string) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ points: NetWorthPoint[] }>(
        `/api/dashboard/net-worth-history?period=${p}`
      );
      setChartData(data.points);
    } catch {
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(period);
  }, [period, fetchHistory]);

  // Determine chart color based on trend
  const firstVal = chartData[0]?.net_worth ?? 0;
  const lastVal = chartData[chartData.length - 1]?.net_worth ?? 0;
  const isUp = lastVal >= firstVal;
  const chartColor = isUp ? "#16a34a" : "#dc2626";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth
          </CardTitle>
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

        {/* Chart */}
        {chartData.length > 1 && !isLoading && (
          <div className="h-32 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatDateLabel(d, period)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis hide domain={["dataMin - 1000", "dataMax + 1000"]} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="net_worth"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#nwGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {isLoading && (
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
            Loading chart...
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
  );
}
