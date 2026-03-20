import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { Theme } from "@/src/lib/theme";
import { apiFetch } from "@/src/lib/api-client";

interface NetWorthData {
  total_assets: number | string;
  total_liabilities: number | string;
  net_worth: number | string;
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
  { value: "all", label: "All" },
];

function formatDateLabel(dateStr: string, period: string): string {
  const d = new Date(dateStr);
  if (period === "1m" || period === "3m") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function NetWorthChart({
  data,
  period,
  theme,
}: {
  data: NetWorthPoint[];
  period: string;
  theme: Theme;
}) {
  const { width: screenWidth } = useWindowDimensions();

  if (data.length < 2) return null;

  const chartWidth = screenWidth - 64; // card padding + margins
  const chartHeight = 120;
  const paddingTop = 8;
  const paddingBottom = 20;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const values = data.map((p) => p.net_worth);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const isUp = lastVal >= firstVal;
  const strokeColor = isUp ? theme.colors.success : theme.colors.error;

  const points = data.map((point, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + graphHeight - ((point.net_worth - minVal) / range) * graphHeight;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${paddingTop + graphHeight}` +
    ` L ${points[0].x} ${paddingTop + graphHeight} Z`;

  // Pick ~4 evenly spaced labels
  const labelCount = Math.min(4, data.length);
  const labelIndices: number[] = [];
  for (let i = 0; i < labelCount; i++) {
    labelIndices.push(Math.round((i / (labelCount - 1)) * (data.length - 1)));
  }

  return (
    <View style={styles.chartContainer}>
      <Svg width={chartWidth} height={chartHeight}>
        <Path d={areaPath} fill={strokeColor} opacity={0.1} />
        <Path d={linePath} stroke={strokeColor} strokeWidth={2} fill="none" />
        {labelIndices.map((idx) => (
          <SvgText
            key={idx}
            x={points[idx].x}
            y={chartHeight - 2}
            fontSize={9}
            fill={theme.colors.textSecondary}
            textAnchor="middle"
          >
            {formatDateLabel(data[idx].date, period)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export function NetWorthCard({ data }: { data: NetWorthData }) {
  const { theme } = useTheme();
  const netWorth =
    typeof data.net_worth === "string"
      ? parseFloat(data.net_worth)
      : data.net_worth;

  const [period, setPeriod] = useState("1m");
  const [chartData, setChartData] = useState<NetWorthPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chartError, setChartError] = useState(false);

  const fetchHistory = useCallback(async (p: string) => {
    setIsLoading(true);
    setChartError(false);
    try {
      const result = await apiFetch<{ points: NetWorthPoint[] }>(
        `/api/dashboard/net-worth-history?period=${p}`
      );
      setChartData(result.points);
    } catch {
      setChartData([]);
      setChartError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(period);
  }, [period, fetchHistory]);

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Net Worth
        </Text>
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={[
                styles.periodButton,
                period === p.value && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.periodLabel,
                  {
                    color:
                      period === p.value
                        ? theme.colors.primaryText
                        : theme.colors.textSecondary,
                  },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text
        style={[
          styles.amount,
          { color: netWorth >= 0 ? theme.colors.success : theme.colors.error },
        ]}
      >
        {formatCurrency(data.net_worth)}
      </Text>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
      {!isLoading && chartError && (
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
            Could not load chart
          </Text>
        </View>
      )}
      {!isLoading && !chartError && chartData.length > 1 && (
        <NetWorthChart data={chartData} period={period} theme={theme} />
      )}

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
            Assets
          </Text>
          <Text style={[styles.subAmount, { color: theme.colors.success }]}>
            {formatCurrency(data.total_assets)}
          </Text>
        </View>
        <View style={styles.half}>
          <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
            Liabilities
          </Text>
          <Text style={[styles.subAmount, { color: theme.colors.error }]}>
            {formatCurrency(data.total_liabilities)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 14 },
  periodRow: { flexDirection: "row", gap: 2 },
  periodButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  periodLabel: { fontSize: 11, fontWeight: "600" },
  amount: { fontSize: 32, fontWeight: "bold", marginTop: 4 },
  chartContainer: { marginTop: 12, alignItems: "center" },
  loadingContainer: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  row: { flexDirection: "row", marginTop: 16, gap: 16 },
  half: { flex: 1 },
  subLabel: { fontSize: 12 },
  subAmount: { fontSize: 16, fontWeight: "600", marginTop: 2 },
});
