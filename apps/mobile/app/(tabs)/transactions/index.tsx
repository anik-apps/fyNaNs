import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Text,
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

function getDateLabel(filters: FilterValues): string {
  if (filters.dateFrom && !filters.dateTo) {
    const days = Math.round((Date.now() - new Date(filters.dateFrom).getTime()) / 86400000);
    if (days <= 8) return 'Last 7 days';
    if (days <= 31) return 'Last 30 days';
    if (days <= 91) return 'Last 3 months';
    if (days <= 181) return 'Last 6 months';
    if (days <= 366) return 'Last year';
    return `Since ${filters.dateFrom}`;
  }
  if (filters.dateFrom && filters.dateTo) return `${filters.dateFrom} — ${filters.dateTo}`;
  return 'Custom date';
}

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
    categoryId: "",
    categoryName: "",
    dateFrom: "",
    dateTo: "",
  });

  const activeFilterCount = [filters.categoryId, filters.dateFrom, filters.search].filter(Boolean).length;

  const fetchTransactions = useCallback(
    async (cursor?: string | null) => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (cursor) params.set("cursor", cursor);
        if (filters.search) params.set("search", filters.search);
        if (filters.categoryId) params.set("category_id", filters.categoryId);
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
          style={[
            styles.filterBtn,
            activeFilterCount > 0
              ? { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }
              : { borderColor: theme.colors.border },
          ]}
          onPress={() => setShowFilters(true)}
        >
          <SlidersHorizontal
            color={activeFilterCount > 0 ? theme.colors.primary : theme.colors.textSecondary}
            size={20}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
        >
          {filters.categoryName && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}
              onPress={() => setFilters(f => ({ ...f, categoryId: '', categoryName: '' }))}
            >
              <Text style={[styles.chipText, { color: theme.colors.primary }]}>{filters.categoryName}</Text>
              <Text style={[styles.chipClose, { color: theme.colors.primary + '80' }]}>×</Text>
            </TouchableOpacity>
          )}
          {filters.dateFrom && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}
              onPress={() => setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }))}
            >
              <Text style={[styles.chipText, { color: theme.colors.primary }]}>{getDateLabel(filters)}</Text>
              <Text style={[styles.chipClose, { color: theme.colors.primary + '80' }]}>×</Text>
            </TouchableOpacity>
          )}
          {filters.search && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}
              onPress={() => { setFilters(f => ({ ...f, search: '' })); setSearch(''); }}
            >
              <Text style={[styles.chipText, { color: theme.colors.primary }]}>"{filters.search}"</Text>
              <Text style={[styles.chipClose, { color: theme.colors.primary + '80' }]}>×</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

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
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  chipRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  chipRowContent: {
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chipClose: {
    fontSize: 14,
  },
});
