import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Plus } from "lucide-react-native";
import { BudgetCard } from "@/src/components/budgets/BudgetCard";
import { BudgetForm } from "@/src/components/budgets/BudgetForm";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";

export default function BudgetsScreen() {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error, refresh } = useApi<any[]>(() =>
    apiFetch("/api/budgets")
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  async function handleCreateBudget(budgetData: {
    category_name: string;
    limit_amount: number;
    period: string;
  }) {
    try {
      await apiFetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify(budgetData),
      });
      refresh();
    } catch {
      // Error handled by the form
    }
  }

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
        <ErrorView message={error.message} onRetry={refresh} />
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
        ListEmptyComponent={
          <EmptyState
            title="No budgets"
            description="Create a budget to track your spending"
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
        onSubmit={handleCreateBudget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
