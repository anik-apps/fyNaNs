import React, { useMemo } from "react";
import {
  SectionList,
  RefreshControl,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { TransactionRow } from "./TransactionRow";
import { useTheme } from "@/src/providers/ThemeProvider";
import { formatDate } from "@/src/lib/utils";

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string | number;
  category_name: string;
  category_color?: string;
  account_name: string;
  is_pending: boolean;
}

interface TransactionListProps {
  transactions: Transaction[];
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
}

interface TransactionSection {
  title: string;
  data: Transaction[];
}

function getDateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatDate(d);
}

function groupTransactionsByDate(
  transactions: Transaction[]
): TransactionSection[] {
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const label = getDateGroupLabel(tx.date);
    const existing = groups.get(label);
    if (existing) {
      existing.push(tx);
    } else {
      groups.set(label, [tx]);
    }
  }

  return Array.from(groups.entries()).map(([title, data]) => ({
    title,
    data,
  }));
}

export function TransactionList({
  transactions,
  refreshing,
  onRefresh,
  onLoadMore,
  hasMore,
  isLoadingMore,
  ListHeaderComponent,
  ListEmptyComponent,
}: TransactionListProps) {
  const { theme } = useTheme();
  const router = useRouter();

  const sections = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions]
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TransactionRow
          id={item.id}
          date={item.date}
          description={item.description}
          merchant_name={item.merchant_name}
          amount={item.amount}
          category_name={item.category_name}
          category_color={item.category_color}
          account_name={item.account_name}
          is_pending={item.is_pending}
          onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
        />
      )}
      renderSectionHeader={({ section: { title } }) => (
        <View
          style={[
            styles.sectionHeader,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            {title}
          </Text>
        </View>
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={
        isLoadingMore ? (
          <View style={{ padding: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: 24 }}
      stickySectionHeadersEnabled={true}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
