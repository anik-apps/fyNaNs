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
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Clear selection when data changes (period switch)
  useEffect(() => {
    setSelectedIndex(null);
  }, [data]);

  if (data.length < 2) return null;

  const chartWidth = screenWidth - 64;
  const chartHeight = 200;
  const paddingTop = 24; // room for tooltip
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

  const labelCount = Math.min(4, data.length);
  const labelIndices: number[] = [];
  for (let i = 0; i < labelCount; i++) {
    labelIndices.push(Math.round((i / (labelCount - 1)) * (data.length - 1)));
  }

  const handleTouch = (e: GestureResponderEvent) => {
    const touchX = e.nativeEvent.locationX;
    // Find closest point
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - touchX);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setSelectedIndex(closest);
  };

  const sel = selectedIndex !== null ? selectedIndex : null;

  return (
    <View
      style={styles.chartContainer}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={() => setTimeout(() => setSelectedIndex(null), 5000)}
    >
      <Svg width={chartWidth} height={chartHeight}>
        <Path d={areaPath} fill={strokeColor} opacity={0.1} />
        <Path d={linePath} stroke={strokeColor} strokeWidth={2} fill="none" />
        {/* Start value label */}
        {sel === null && (
          <>
            <Circle
              cx={points[0].x}
              cy={points[0].y}
              r={3}
              fill={strokeColor}
            />
            <SvgText
              x={points[0].x + 4}
              y={points[0].y - 8}
              fontSize={10}
              fontWeight="600"
              fill={theme.colors.textSecondary}
              textAnchor="start"
            >
              {formatCurrency(firstVal)}
            </SvgText>
            {/* End value label */}
            <Circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={3}
              fill={strokeColor}
            />
            <SvgText
              x={points[points.length - 1].x - 4}
              y={points[points.length - 1].y - 8}
              fontSize={10}
              fontWeight="600"
              fill={strokeColor}
              textAnchor="end"
            >
              {formatCurrency(lastVal)}
            </SvgText>
          </>
        )}
        {sel !== null && (
          <>
            <Line
              x1={points[sel].x} y1={paddingTop}
              x2={points[sel].x} y2={paddingTop + graphHeight}
              stroke={theme.colors.textSecondary} strokeWidth={1} strokeDasharray="3,3"
            />
            <Circle
              cx={points[sel].x} cy={points[sel].y}
              r={5} fill={strokeColor} stroke={theme.colors.card} strokeWidth={2}
            />
            <SvgText
              x={Math.min(Math.max(points[sel].x, 50), chartWidth - 50)}
              y={12}
              fontSize={11}
              fontWeight="bold"
              fill={theme.colors.text}
              textAnchor="middle"
            >
              {formatCurrency(data[sel].net_worth)}
            </SvgText>
          </>
        )}
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
      style={[styles.card, { backgroundColor: theme.colors.card }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Net Worth Trend
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
  label: { fontSize: 14 },
  periodRow: { flexDirection: "row", gap: 2 },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  periodLabel: { fontSize: 13, fontWeight: "600" },
  chartContainer: { marginTop: 12, alignItems: "center" },
  loadingContainer: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
});
