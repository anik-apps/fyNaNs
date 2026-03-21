import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  GestureResponderEvent,
} from "react-native";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { Theme } from "@/src/lib/theme";
import { apiFetch } from "@/src/lib/api-client";

interface SpendingData {
  current_month_total: number | string;
  previous_month_total: number | string;
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
  theme: Theme;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const chartWidth = screenWidth - 64;
  const chartHeight = 220;
  const paddingTop = 18;
  const paddingBottom = 24;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...data.flatMap((p) => [p.spending, p.income]),
    1
  );

  const groupWidth = chartWidth / data.length;
  const barWidth = Math.max(4, Math.min(16, groupWidth * 0.3));
  const barGap = 2;

  // Clear selection when data changes (view switch)
  useEffect(() => {
    setSelectedIndex(null);
  }, [data]);

  const handleTouch = (e: GestureResponderEvent) => {
    const touchX = e.nativeEvent.locationX;
    const idx = Math.floor(touchX / groupWidth);
    setSelectedIndex(Math.max(0, Math.min(idx, data.length - 1)));
  };

  const sel = selectedIndex;

  return (
    <View style={styles.chartContainer}>
      {sel !== null && (
        <View
          style={[
            styles.tooltip,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.tooltipLabel, { color: theme.colors.textSecondary }]}>
            {data[sel].label}
          </Text>
          <View style={styles.tooltipRow}>
            <Text style={[styles.tooltipValue, { color: SPENDING_COLOR }]}>
              {`-$${data[sel].spending.toLocaleString()}`}
            </Text>
            <Text style={[styles.tooltipValue, { color: INCOME_COLOR }]}>
              {`+$${data[sel].income.toLocaleString()}`}
            </Text>
          </View>
        </View>
      )}
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={() => setTimeout(() => setSelectedIndex(null), 5000)}
      >
      <Svg width={chartWidth} height={chartHeight}>
        {data.map((point, i) => {
          const groupCenter = groupWidth * i + groupWidth / 2;
          const spendingHeight = (point.spending / maxVal) * graphHeight;
          const incomeHeight = (point.income / maxVal) * graphHeight;
          const isSelected = sel === i;
          const spendingOpacity = sel === null || isSelected ? 1 : 0.4;
          const incomeOpacity = sel === null || isSelected ? 1 : 0.4;

          const showValueLabel = isSelected || (sel === null && i === data.length - 1);

          return (
            <React.Fragment key={i}>
              <Rect
                x={groupCenter - barWidth - barGap / 2}
                y={paddingTop + graphHeight - spendingHeight}
                width={barWidth}
                height={spendingHeight}
                rx={3}
                fill={SPENDING_COLOR}
                opacity={spendingOpacity}
              />
              <Rect
                x={groupCenter + barGap / 2}
                y={paddingTop + graphHeight - incomeHeight}
                width={barWidth}
                height={incomeHeight}
                rx={3}
                fill={INCOME_COLOR}
                opacity={incomeOpacity}
              />
              {showValueLabel && spendingHeight > 0 && (
                <SvgText
                  x={groupCenter - barGap / 2 - barWidth / 2}
                  y={paddingTop + graphHeight - spendingHeight - 4}
                  fontSize={9}
                  fontWeight="bold"
                  fill={SPENDING_COLOR}
                  textAnchor="middle"
                >
                  {`$${Math.round(point.spending).toLocaleString()}`}
                </SvgText>
              )}
              {showValueLabel && incomeHeight > 0 && (
                <SvgText
                  x={groupCenter + barGap / 2 + barWidth / 2}
                  y={paddingTop + graphHeight - incomeHeight - 4}
                  fontSize={9}
                  fontWeight="bold"
                  fill={INCOME_COLOR}
                  textAnchor="middle"
                >
                  {`$${Math.round(point.income).toLocaleString()}`}
                </SvgText>
              )}
              <SvgText
                x={groupCenter}
                y={chartHeight - 2}
                fontSize={9}
                fill={isSelected ? theme.colors.text : theme.colors.textSecondary}
                fontWeight={isSelected ? "bold" : "normal"}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            </React.Fragment>
          );
        })}
        {sel !== null && (
          <>
            <Line
              x1={groupWidth * sel + groupWidth / 2}
              y1={paddingTop}
              x2={groupWidth * sel + groupWidth / 2}
              y2={paddingTop + graphHeight}
              stroke={theme.colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.5}
            />
          </>
        )}
      </Svg>
      </View>
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
    typeof data.current_month_total === "string"
      ? parseFloat(data.current_month_total)
      : data.current_month_total;
  const previous =
    typeof data.previous_month_total === "string"
      ? parseFloat(data.previous_month_total)
      : data.previous_month_total;

  const diff = data.difference != null
    ? typeof data.difference === "string"
      ? parseFloat(data.difference)
      : data.difference
    : current - previous;
  const isUp = diff > 0;
  const percentChange = data.percent_change ?? null;

  const [view, setView] = useState("monthly");
  const [chartData, setChartData] = useState<SpendingPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chartError, setChartError] = useState(false);

  const fetchHistory = useCallback(async (v: string) => {
    setIsLoading(true);
    setChartError(false);
    try {
      const isYearly = v === "yearly";
      const months = v === "monthly-12" ? 12 : v === "yearly" ? 60 : 6;
      const result = await apiFetch<{ points: SpendingPoint[] }>(
        `/api/dashboard/spending-history?view=${isYearly ? "yearly" : "monthly"}&months=${months}`
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
    fetchHistory(view);
  }, [view, fetchHistory]);

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card }]}
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
      {!isLoading && chartError && (
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
            Could not load chart
          </Text>
        </View>
      )}
      {!isLoading && !chartError && chartData.length > 0 && (
        <SpendingBarChart data={chartData} theme={theme} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 14 },
  viewRow: { flexDirection: "row", gap: 2 },
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewLabel: { fontSize: 13, fontWeight: "600" },
  currentAmount: { fontSize: 24, fontWeight: "bold", marginTop: 8 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  changeText: { fontSize: 13, fontWeight: "500" },
  changeContext: { fontSize: 13 },
  chartContainer: { marginTop: 12, alignItems: "center", position: "relative" },
  tooltip: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    zIndex: 10,
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tooltipLabel: { fontSize: 11, marginBottom: 2 },
  tooltipRow: { flexDirection: "row", gap: 12 },
  tooltipValue: { fontSize: 12, fontWeight: "bold" },
  loadingContainer: {
    height: 200,
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
