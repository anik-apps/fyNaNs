import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SlidersHorizontal } from "lucide-react-native";
import { TransactionList } from "@/src/components/transactions/TransactionList";
import {
  FilterSheet,
  type FilterValues,
} from "@/src/components/transactions/FilterSheet";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";

export default function TransactionsScreen() {
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    category: "",
    dateFrom: "",
    dateTo: "",
  });

  const fetchTransactions = useCallback(
    async (cursor?: string | null) => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (cursor) params.set("cursor", cursor);
        if (filters.search) params.set("search", filters.search);
        if (filters.category) params.set("category", filters.category);
        if (filters.dateFrom) params.set("date_from", filters.dateFrom);
        if (filters.dateTo) params.set("date_to", filters.dateTo);

        const result = await apiFetch<{ items: any[]; next_cursor: string | null }>(
          `/api/transactions?${params.toString()}`
        );

        if (cursor) {
          setTransactions((prev) => [...prev, ...result.items]);
        } else {
          setTransactions(result.items);
        }
        setNextCursor(result.next_cursor);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load transactions"
        );
      }
    },
    [filters]
  );

  useEffect(() => {
    setIsLoading(true);
    fetchTransactions().finally(() => setIsLoading(false));
  }, [fetchTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, [fetchTransactions]);

  const onLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchTransactions(nextCursor);
    setIsLoadingMore(false);
  }, [nextCursor, isLoadingMore, fetchTransactions]);

  function handleApplyFilters(newFilters: FilterValues) {
    setFilters(newFilters);
    setSearch(newFilters.search);
  }

  function handleSearchSubmit() {
    setFilters((prev) => ({ ...prev, search }));
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

  if (error && !transactions.length) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ErrorView message={error} onRetry={() => fetchTransactions()} />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
    >
      <View
        style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearchSubmit}
          placeholder="Search transactions..."
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[styles.filterBtn, { borderColor: theme.colors.border }]}
          onPress={() => setShowFilters(true)}
        >
          <SlidersHorizontal color={theme.colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <TransactionList
        transactions={transactions}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
        hasMore={!!nextCursor}
        isLoadingMore={isLoadingMore}
        ListEmptyComponent={
          <EmptyState
            title="No transactions"
            description="Your transactions will appear here"
          />
        }
      />

      <FilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchBar: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  filterBtn: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
