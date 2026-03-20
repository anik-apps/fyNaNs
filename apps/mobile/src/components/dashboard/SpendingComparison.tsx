import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import { apiFetch } from "@/src/lib/api-client";

interface SpendingData {
  current_month: number | string;
  previous_month: number | string;
  difference?: number | string;
  percent_change?: number | null;
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

const SPENDING_COLOR = "#EF4444";
const INCOME_COLOR = "#22C55E";

function SpendingBarChart({
  data,
  theme,
}: {
  data: SpendingPoint[];
  theme: any;
}) {
  if (data.length === 0) return null;

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 64;
  const chartHeight = 150;
  const paddingTop = 8;
  const paddingBottom = 24;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...data.flatMap((p) => [p.spending, p.income]),
    1
  );

  const groupWidth = chartWidth / data.length;
  const barWidth = Math.max(4, Math.min(16, groupWidth * 0.3));
  const barGap = 2;

  return (
    <View style={styles.chartContainer}>
      <Svg width={chartWidth} height={chartHeight}>
        {data.map((point, i) => {
          const groupCenter = groupWidth * i + groupWidth / 2;
          const spendingHeight = (point.spending / maxVal) * graphHeight;
          const incomeHeight = (point.income / maxVal) * graphHeight;

          return (
            <React.Fragment key={i}>
              <Rect
                x={groupCenter - barWidth - barGap / 2}
                y={paddingTop + graphHeight - spendingHeight}
                width={barWidth}
                height={spendingHeight}
                rx={3}
                fill={SPENDING_COLOR}
              />
              <Rect
                x={groupCenter + barGap / 2}
                y={paddingTop + graphHeight - incomeHeight}
                width={barWidth}
                height={incomeHeight}
                rx={3}
                fill={INCOME_COLOR}
              />
              <SvgText
                x={groupCenter}
                y={chartHeight - 2}
                fontSize={9}
                fill={theme.colors.textSecondary}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SPENDING_COLOR }]} />
          <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
            Spending
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: INCOME_COLOR }]} />
          <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
            Income
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SpendingComparison({ data }: { data: SpendingData }) {
  const { theme } = useTheme();
  const current =
    typeof data.current_month === "string"
      ? parseFloat(data.current_month)
      : data.current_month;
  const previous =
    typeof data.previous_month === "string"
      ? parseFloat(data.previous_month)
      : data.previous_month;

  const diff = data.difference
    ? typeof data.difference === "string"
      ? parseFloat(data.difference)
      : data.difference
    : current - previous;
  const isUp = diff > 0;
  const percentChange = data.percent_change ?? null;

  const [view, setView] = useState("monthly");
  const [chartData, setChartData] = useState<SpendingPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async (v: string) => {
    setIsLoading(true);
    try {
      const isYearly = v === "yearly";
      const months = v === "monthly-12" ? 12 : v === "yearly" ? 60 : 6;
      const result = await apiFetch<{ points: SpendingPoint[] }>(
        `/api/dashboard/spending-history?view=${isYearly ? "yearly" : "monthly"}&months=${months}`
      );
      setChartData(result.points);
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
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.textSecondary }]}>
          Spending & Income
        </Text>
        <View style={styles.viewRow}>
          {VIEWS.map((v) => (
            <TouchableOpacity
              key={v.value}
              onPress={() => setView(v.value)}
              style={[
                styles.viewButton,
                view === v.value && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.viewLabel,
                  {
                    color:
                      view === v.value
                        ? theme.colors.primaryText
                        : theme.colors.textSecondary,
                  },
                ]}
              >
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.currentAmount, { color: theme.colors.text }]}>
        {formatCurrency(current)}
      </Text>
      <View style={styles.changeRow}>
        <Text
          style={[
            styles.changeText,
            { color: isUp ? theme.colors.error : theme.colors.success },
          ]}
        >
          {isUp ? "+" : ""}
          {percentChange !== null ? `${percentChange}%` : "N/A"}
        </Text>
        <Text style={[styles.changeContext, { color: theme.colors.textSecondary }]}>
          vs last month ({formatCurrency(previous)})
        </Text>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
      {!isLoading && chartData.length > 0 && (
        <SpendingBarChart data={chartData} theme={theme} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 14 },
  viewRow: { flexDirection: "row", gap: 2 },
  viewButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewLabel: { fontSize: 11, fontWeight: "600" },
  currentAmount: { fontSize: 24, fontWeight: "bold", marginTop: 8 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  changeText: { fontSize: 13, fontWeight: "500" },
  changeContext: { fontSize: 13 },
  chartContainer: { marginTop: 12, alignItems: "center" },
  loadingContainer: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10 },
});
