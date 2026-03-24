"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { Expand } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { ChartModal } from "./chart-modal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
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
  { value: "monthly", label: "6M" },
  { value: "monthly-12", label: "12M" },
  { value: "yearly", label: "Yearly" },
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload?.length) {
    return (
      <div className="bg-popover border rounded-md px-3 py-2 shadow-md text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

function SpendingBarChart({
  data,
  height,
  showGrid = false,
}: {
  data: SpendingPoint[];
  height: string | number;
  showGrid?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
        )}
        <XAxis
          dataKey="label"
          tick={{ fontSize: showGrid ? 12 : 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          hide={!showGrid}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={55}
          domain={[0, "auto"]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: showGrid ? "12px" : "10px" }} />
        <Bar dataKey="spending" name="Spending" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={showGrid ? 48 : 32} />
        <Bar dataKey="income" name="Income" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={showGrid ? 48 : 32} />
      </BarChart>
    </ResponsiveContainer>
  );
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
  const [modalOpen, setModalOpen] = useState(false);

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

          {chartData.length > 0 && !isLoading && (
            <div
              className="h-40 -mx-2 cursor-pointer"
              onClick={() => setModalOpen(true)}
            >
              <SpendingBarChart data={chartData} height="100%" />
            </div>
          )}
          {isLoading && (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
              Loading chart...
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
