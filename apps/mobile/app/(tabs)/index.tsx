import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { NetWorthCard } from "@/src/components/dashboard/NetWorthCard";
import { SpendingComparison } from "@/src/components/dashboard/SpendingComparison";
import { BudgetBars } from "@/src/components/dashboard/BudgetBars";
import { UpcomingBills } from "@/src/components/dashboard/UpcomingBills";
import { RecentTransactions } from "@/src/components/dashboard/RecentTransactions";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { ErrorView } from "@/src/components/shared/ErrorView";

export default function DashboardScreen() {
  const { theme } = useTheme();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const result = await apiFetch<any>("/api/dashboard");
      setData(result);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard"
      );
    }
  }, []);

  useEffect(() => {
    fetchDashboard().finally(() => setIsLoading(false));
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ErrorView message={error} onRetry={fetchDashboard} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {data?.net_worth && <NetWorthCard data={data.net_worth} />}
      {data?.spending_comparison && (
        <SpendingComparison data={data.spending_comparison} />
      )}
      {data?.top_budgets && <BudgetBars budgets={data.top_budgets} />}
      {data?.upcoming_bills && <UpcomingBills bills={data.upcoming_bills} />}
      {data?.recent_transactions && (
        <RecentTransactions transactions={data.recent_transactions} />
      )}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  bottomPadding: { height: 24 },
});
