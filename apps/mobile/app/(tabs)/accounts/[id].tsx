import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { formatCurrency, formatRelativeDate } from "@/src/lib/utils";
import { ACCOUNT_TYPE_LABELS } from "@fynans/shared-types";
import {
  CategoryDonutChart,
  type CategorySlice,
} from "@/src/components/accounts/CategoryDonutChart";

const INCOME_CATEGORIES = new Set([
  "Income",
  "Salary",
  "Freelance",
  "Other Income",
  "Investments",
]);
const TRANSFER_CATEGORIES = new Set(["Transfer"]);
const SKIP_CATEGORIES = new Set([
  "Income",
  "Salary",
  "Freelance",
  "Other Income",
  "Investments",
  "Transfer",
]);

function getDisplayType(
  amount: number,
  categoryName: string
): "income" | "expense" | "transfer" {
  if (TRANSFER_CATEGORIES.has(categoryName)) return "transfer";
  if (INCOME_CATEGORIES.has(categoryName)) return "income";
  return amount < 0 ? "income" : "expense";
}

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: account, isLoading, error, refresh } = useApi<any>(() =>
    apiFetch(`/api/accounts/${id}`)
  );

  const {
    data: txData,
    isLoading: txLoading,
    refresh: refreshTx,
  } = useApi<any>(() =>
    apiFetch(`/api/transactions?account_id=${id}&limit=50`)
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshTx()]);
    setRefreshing(false);
  }, [refresh, refreshTx]);

  const transactions = txData?.items || txData || [];

  const categoryBreakdown = useMemo((): CategorySlice[] => {
    const map: Record<string, CategorySlice> = {};
    for (const txn of transactions) {
      const cat = txn.category_name || "Uncategorized";
      if (SKIP_CATEGORIES.has(cat)) continue;
      const amt = Math.abs(
        typeof txn.amount === "string" ? parseFloat(txn.amount) : txn.amount
      );
      if (!map[cat]) {
        map[cat] = { name: cat, color: txn.category_color || "#6b7280", total: 0 };
      }
      map[cat].total += amt;
    }
    return Object.values(map)
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !account) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ErrorView
          message={error?.message || "Account not found"}
          onRetry={refresh}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
    >
      <Stack.Screen
        options={{ headerShown: true, title: account.name }}
      />

      <FlatList
        data={transactions}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={
          <>
            <View
              style={[
                styles.header,
                { backgroundColor: theme.colors.card },
              ]}
            >
              <Text style={[styles.balance, { color: theme.colors.text }]}>
                {formatCurrency(account.balance)}
              </Text>
              <Text
                style={[styles.accountType, { color: theme.colors.textSecondary }]}
              >
                {ACCOUNT_TYPE_LABELS[account.type as keyof typeof ACCOUNT_TYPE_LABELS] || account.type}
                {account.institution_name
                  ? ` · ${account.institution_name}`
                  : ""}
              </Text>
            </View>
            {categoryBreakdown.length > 0 && (
              <View style={[styles.chartCard, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Spending by Category
                </Text>
                <CategoryDonutChart data={categoryBreakdown} />
              </View>
            )}
            <Text style={[styles.txSectionTitle, { color: theme.colors.text }]}>
              Transactions
            </Text>
          </>
        }
        renderItem={({ item }: { item: any }) => {
          const numAmount =
            typeof item.amount === "string"
              ? parseFloat(item.amount)
              : item.amount;
          const absAmount = Math.abs(numAmount);
          const displayType = getDisplayType(numAmount, item.category_name);
          const amountColor =
            displayType === "income"
              ? theme.colors.success
              : displayType === "expense"
              ? theme.colors.error
              : theme.colors.textSecondary;
          const prefix =
            displayType === "income"
              ? "+"
              : displayType === "expense"
              ? "-"
              : "";

          return (
            <TouchableOpacity
              style={[
                styles.txRow,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.txInfo}>
                <Text
                  style={[styles.txName, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {item.merchant_name || item.description}
                </Text>
                <Text
                  style={[styles.txMeta, { color: theme.colors.textSecondary }]}
                >
                  {item.category_name} · {formatRelativeDate(item.date)}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: amountColor }]}>
                {prefix}
                {formatCurrency(absAmount)}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          txLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{ marginTop: 24 }}
            />
          ) : (
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.textSecondary },
              ]}
            >
              No transactions found
            </Text>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  balance: { fontSize: 32, fontWeight: "bold" },
  accountType: { fontSize: 14, marginTop: 4 },
  chartCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  txSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 4,
    marginHorizontal: 16,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderBottomWidth: 1,
  },
  txInfo: { flex: 1, marginRight: 12 },
  txName: { fontSize: 14, fontWeight: "500" },
  txMeta: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "600" },
  emptyText: { textAlign: "center", marginTop: 24, fontSize: 14 },
  listContent: { paddingBottom: 24 },
});
