import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import { BUDGET_THRESHOLDS } from "@fynans/shared-types";

interface Budget {
  id: string;
  category_name: string;
  limit_amount: number | string;
  spent_amount: number | string;
}

export function BudgetBars({ budgets }: { budgets: Budget[] }) {
  const { theme } = useTheme();

  if (!budgets?.length) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Top Budgets
      </Text>
      {budgets.slice(0, 5).map((budget) => {
        const spent =
          typeof budget.spent_amount === "string"
            ? parseFloat(budget.spent_amount)
            : budget.spent_amount;
        const limit =
          typeof budget.limit_amount === "string"
            ? parseFloat(budget.limit_amount)
            : budget.limit_amount;
        const pct = limit > 0 ? (spent / limit) * 100 : 0;
        const barColor =
          pct >= BUDGET_THRESHOLDS.EXCEEDED
            ? theme.colors.error
            : pct >= BUDGET_THRESHOLDS.WARNING
            ? theme.colors.warning
            : theme.colors.success;

        return (
          <View key={budget.id} style={styles.budgetRow}>
            <View style={styles.budgetHeader}>
              <Text style={[styles.budgetName, { color: theme.colors.text }]}>
                {budget.category_name}
              </Text>
              <Text
                style={[styles.budgetAmount, { color: theme.colors.textSecondary }]}
              >
                {formatCurrency(spent)} / {formatCurrency(limit)}
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.colors.skeleton }]}>
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
          </View>
        );
      })}
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
  title: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  budgetRow: { marginBottom: 12 },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  budgetName: { fontSize: 13, fontWeight: "500" },
  budgetAmount: { fontSize: 12 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
});
