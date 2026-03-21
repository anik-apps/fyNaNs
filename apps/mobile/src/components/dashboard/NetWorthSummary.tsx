import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";

interface NetWorthData {
  total_assets: number | string;
  total_liabilities: number | string;
  net_worth: number | string;
}

export function NetWorthSummary({ data, previousNetWorth }: { data: NetWorthData; previousNetWorth?: number }) {
  const { theme } = useTheme();
  const netWorth =
    typeof data.net_worth === "string"
      ? parseFloat(data.net_worth)
      : data.net_worth;
  const totalAssets =
    typeof data.total_assets === "string"
      ? parseFloat(data.total_assets)
      : data.total_assets;
  const totalLiabilities =
    typeof data.total_liabilities === "string"
      ? parseFloat(data.total_liabilities)
      : data.total_liabilities;

  const netWorthColor =
    netWorth >= 0 ? theme.colors.success : theme.colors.error;

  const percentChange =
    previousNetWorth != null && previousNetWorth !== 0
      ? ((netWorth - previousNetWorth) / Math.abs(previousNetWorth)) * 100
      : null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        Net Worth
      </Text>
      <Text style={[styles.netWorth, { color: netWorthColor }]}>
        {formatCurrency(netWorth)}
      </Text>
      {percentChange !== null && (
        <View
          style={[
            styles.trendBadge,
            {
              backgroundColor:
                percentChange >= 0
                  ? theme.colors.success + "15"
                  : theme.colors.error + "15",
            },
          ]}
        >
          <Text
            style={{
              color:
                percentChange >= 0
                  ? theme.colors.success
                  : theme.colors.error,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {percentChange >= 0 ? "▲" : "▼"}{" "}
            {Math.abs(percentChange).toFixed(1)}% this month
          </Text>
        </View>
      )}
      <View style={styles.breakdown}>
        <View style={styles.breakdownItem}>
          <Text
            style={[styles.breakdownLabel, { color: theme.colors.textSecondary }]}
          >
            Assets
          </Text>
          <Text style={[styles.breakdownValue, { color: theme.colors.success }]}>
            {formatCurrency(totalAssets)}
          </Text>
        </View>
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />
        <View style={styles.breakdownItem}>
          <Text
            style={[styles.breakdownLabel, { color: theme.colors.textSecondary }]}
          >
            Liabilities
          </Text>
          <Text style={[styles.breakdownValue, { color: theme.colors.error }]}>
            {formatCurrency(totalLiabilities)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    padding: 20,
    alignItems: "center",
  },
  trendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  netWorth: {
    fontSize: 40,
    fontWeight: "bold",
    marginTop: 4,
  },
  breakdown: {
    flexDirection: "row",
    marginTop: 16,
    alignItems: "center",
    gap: 16,
  },
  breakdownItem: {
    alignItems: "center",
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 32,
  },
});
