import React, { useState, useCallback } from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { NetWorthSummary } from "@/src/components/dashboard/NetWorthSummary";
import { NetWorthCard } from "@/src/components/dashboard/NetWorthCard";
import { SpendingComparison } from "@/src/components/dashboard/SpendingComparison";
import { BudgetBars } from "@/src/components/dashboard/BudgetBars";
import { UpcomingBills } from "@/src/components/dashboard/UpcomingBills";
import { RecentTransactions } from "@/src/components/dashboard/RecentTransactions";
import { GoalsNeedingAttentionCard } from "@/src/components/dashboard/GoalsNeedingAttentionCard";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { Skeleton, CardSkeleton } from "@/src/components/shared/LoadingSkeleton";

export default function DashboardScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<any>("/api/dashboard"),
  });
  useRefreshOnFocus(refetch);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.skeletonWrap}>
          {/* Net worth card */}
          <CardSkeleton />
          {/* Spending / budgets card */}
          <CardSkeleton />
          {/* List rows (bills / recent transactions) */}
          <View style={styles.skeletonRows}>
            <Skeleton width="100%" height={52} borderRadius={12} />
            <Skeleton width="100%" height={52} borderRadius={12} />
            <Skeleton width="100%" height={52} borderRadius={12} />
          </View>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ErrorView message={error.message} onRetry={() => refetch()} />
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
      {data?.net_worth && <NetWorthSummary data={data.net_worth} />}
      {data?.net_worth && <NetWorthCard data={data.net_worth} />}
      {data?.spending_comparison && (
        <SpendingComparison data={data.spending_comparison} />
      )}
      {data?.top_budgets && <BudgetBars budgets={data.top_budgets} />}
      <GoalsNeedingAttentionCard
        topGoals={data?.top_goals ?? []}
        activeCount={data?.active_goals_count ?? 0}
      />
      {data?.upcoming_bills && <UpcomingBills bills={data.upcoming_bills} />}
      {data?.recent_transactions && (
        <RecentTransactions
          transactions={data.recent_transactions}
          onSeeAll={() => router.push("/(tabs)/transactions")}
          onTransactionPress={(id) => router.push(`/(tabs)/transactions/${id}`)}
        />
      )}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  bottomPadding: { height: 24 },
  skeletonWrap: { paddingTop: 12 },
  skeletonRows: { paddingHorizontal: 16, gap: 12 },
});
