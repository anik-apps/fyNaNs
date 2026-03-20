import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";

interface SpendingData {
  current_month: number | string;
  previous_month: number | string;
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
  const maxVal = Math.max(current, previous, 1);

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Spending
      </Text>
      <View style={styles.barGroup}>
        <View style={styles.barRow}>
          <Text style={[styles.barLabel, { color: theme.colors.textSecondary }]}>
            This month
          </Text>
          <View style={[styles.barTrack, { backgroundColor: theme.colors.skeleton }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(current / maxVal) * 100}%`,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.barAmount, { color: theme.colors.text }]}>
            {formatCurrency(current)}
          </Text>
        </View>
        <View style={styles.barRow}>
          <Text style={[styles.barLabel, { color: theme.colors.textSecondary }]}>
            Last month
          </Text>
          <View style={[styles.barTrack, { backgroundColor: theme.colors.skeleton }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(previous / maxVal) * 100}%`,
                  backgroundColor: theme.colors.textSecondary,
                },
              ]}
            />
          </View>
          <Text style={[styles.barAmount, { color: theme.colors.text }]}>
            {formatCurrency(previous)}
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
    marginTop: 12,
    borderWidth: 1,
  },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  barGroup: { gap: 12 },
  barRow: { gap: 4 },
  barLabel: { fontSize: 12 },
  barTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barAmount: { fontSize: 14, fontWeight: "500" },
});
