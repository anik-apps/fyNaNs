"use client";

import { formatCurrency } from "@/lib/utils";
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

export interface SpendingPoint {
  label: string;
  spending: number;
  income: number;
}

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

export default function SpendingBarChart({
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
