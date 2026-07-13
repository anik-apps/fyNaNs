"use client";

import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";

export default function CategoryPieChart({
  data,
  size = 112,
  innerRadius = 25,
  outerRadius = 50,
}: {
  data: Array<{ name: string; color: string; total: number }>;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  return (
    <ResponsiveContainer width={size} height={size}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            fontSize: "12px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--popover)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
