import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import { BUDGET_THRESHOLDS, BUDGET_PERIOD_LABELS, type BudgetPeriod } from "@fynans/shared-types";

interface BudgetCardProps {
  id: string;
  category_name: string;
  category_color?: string;
  limit_amount: string | number;
  spent_amount: string | number;
  period: BudgetPeriod;
}

export function BudgetCard({
  category_name,
  category_color,
  limit_amount,
  spent_amount,
  period,
}: BudgetCardProps) {
  const { theme } = useTheme();
  const spent =
    typeof spent_amount === "string"
      ? parseFloat(spent_amount)
      : spent_amount;
  const limit =
    typeof limit_amount === "string"
      ? parseFloat(limit_amount)
      : limit_amount;
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const remaining = limit - spent;

  const barColor =
    pct >= BUDGET_THRESHOLDS.EXCEEDED
      ? theme.colors.error
      : pct >= BUDGET_THRESHOLDS.WARNING
      ? theme.colors.warning
      : theme.colors.success;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.categoryRow}>
          {category_color && (
            <View
              style={[styles.colorDot, { backgroundColor: category_color }]}
            />
          )}
          <Text style={[styles.categoryName, { color: theme.colors.text }]}>
            {category_name}
          </Text>
        </View>
        <Text style={[styles.period, { color: theme.colors.textSecondary }]}>
          {BUDGET_PERIOD_LABELS[period]}
        </Text>
      </View>

      <View style={styles.amountRow}>
        <Text style={[styles.spent, { color: theme.colors.text }]}>
          {formatCurrency(spent)}
        </Text>
        <Text style={[styles.limit, { color: theme.colors.textSecondary }]}>
          of {formatCurrency(limit)}
        </Text>
      </View>

      <View
        style={[styles.barTrack, { backgroundColor: theme.colors.skeleton }]}
      >
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.remaining,
          {
            color:
              remaining >= 0
                ? theme.colors.textSecondary
                : theme.colors.error,
          },
        ]}
      >
        {remaining >= 0
          ? `${formatCurrency(remaining)} remaining`
          : `${formatCurrency(Math.abs(remaining))} over budget`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { fontSize: 15, fontWeight: "600" },
  period: { fontSize: 12 },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 8,
  },
  spent: { fontSize: 20, fontWeight: "bold" },
  limit: { fontSize: 14 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10,
  },
  barFill: { height: 8, borderRadius: 4 },
  remaining: { fontSize: 12, marginTop: 6 },
});
