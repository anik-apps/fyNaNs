"use client";

import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface NetWorthPoint {
  date: string;
  net_worth: number;
}

function formatDateLabel(dateStr: string, period: string): string {
  const d = new Date(dateStr);
  if (period === "1m" || period === "3m") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: NetWorthPoint }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (active && payload?.[0]) {
    const point = payload[0].payload;
    return (
      <div className="bg-popover border rounded-md px-3 py-2 shadow-md text-sm">
        <p className="text-muted-foreground">
          {new Date(point.date).toLocaleDateString("en-US", {
            month: "long", day: "numeric", year: "numeric",
          })}
        </p>
        <p className="font-semibold">{formatCurrency(point.net_worth)}</p>
      </div>
    );
  }
  return null;
}

export default function NWChart({
  data,
  period,
  height,
  showGrid = false,
}: {
  data: NetWorthPoint[];
  period: string;
  height: string | number;
  showGrid?: boolean;
}) {
  const firstVal = data[0]?.net_worth ?? 0;
  const lastVal = data[data.length - 1]?.net_worth ?? 0;
  const isUp = lastVal >= firstVal;
  const chartColor = isUp ? "#16a34a" : "#dc2626";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
        )}
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDateLabel(d, period)}
          tick={{ fontSize: showGrid ? 12 : 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={showGrid ? 60 : 40}
        />
        <YAxis
          hide={!showGrid}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={55}
          domain={["dataMin - 1000", "dataMax + 1000"]}
        />
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
  );
}
