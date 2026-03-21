import React from "react";
import { FlatList, RefreshControl, ActivityIndicator, View } from "react-native";
import { TransactionRow } from "./TransactionRow";
import { useTheme } from "@/src/providers/ThemeProvider";

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

  return (
    <FlatList
      data={transactions}
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
        />
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
    />
  );
}
