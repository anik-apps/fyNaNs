import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";

interface NetWorthData {
  total_assets: number | string;
  total_liabilities: number | string;
  net_worth: number | string;
}

export function NetWorthCard({ data }: { data: NetWorthData }) {
  const { theme } = useTheme();
  const netWorth =
    typeof data.net_worth === "string"
      ? parseFloat(data.net_worth)
      : data.net_worth;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        Net Worth
      </Text>
      <Text
        style={[
          styles.amount,
          { color: netWorth >= 0 ? theme.colors.success : theme.colors.error },
        ]}
      >
        {formatCurrency(data.net_worth)}
      </Text>
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
  label: { fontSize: 14 },
  amount: { fontSize: 32, fontWeight: "bold", marginTop: 4 },
  row: { flexDirection: "row", marginTop: 16, gap: 16 },
  half: { flex: 1 },
  subLabel: { fontSize: 12 },
  subAmount: { fontSize: 16, fontWeight: "600", marginTop: 2 },
});
