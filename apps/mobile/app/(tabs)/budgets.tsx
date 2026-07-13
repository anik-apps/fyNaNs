import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import { Plus, Wallet } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BudgetCard } from "@/src/components/budgets/BudgetCard";
import { BudgetForm } from "@/src/components/budgets/BudgetForm";
import { GoalsSection } from "@/src/components/goals/GoalsSection";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { CardSkeleton } from "@/src/components/shared/LoadingSkeleton";

export default function BudgetsScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => apiFetch<any[]>("/api/budgets"),
  });
  useRefreshOnFocus(refetch);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const createBudget = useMutation({
    mutationFn: (budgetData: {
      category_name: string;
      limit_amount: number;
      period: string;
    }) =>
      apiFetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify(budgetData),
      }),
    // Return the promise so mutateAsync (and the form's pending state)
    // resolves only after the lists have refreshed.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.skeletonWrap,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  }

  // Keep showing cached budgets if a background refetch fails.
  if (error && !data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ErrorView message={error.message} onRetry={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <FlatList
        data={data || []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <BudgetCard
            id={item.id}
            category_name={item.category_name}
            category_color={item.category_color}
            limit_amount={item.limit_amount}
            spent_amount={item.spent_amount}
            period={item.period}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={<GoalsSection />}
        ListEmptyComponent={
          <EmptyState
            icon={<Wallet color={theme.colors.primary} size={32} />}
            title="No budgets yet"
            description="Set spending limits by category and get notified before you overspend"
            action={
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowForm(true)}
              >
                <Text style={styles.addBtnText}>Create Budget</Text>
              </TouchableOpacity>
            }
          />
        }
      />

      {(data?.length ?? 0) > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowForm(true)}
        >
          <Plus color="#FFF" size={24} />
        </TouchableOpacity>
      )}

      <BudgetForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={async (budgetData) => {
          await createBudget.mutateAsync(budgetData);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  skeletonWrap: { paddingTop: 12 },
  list: { paddingTop: 12, paddingBottom: 80 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
});
