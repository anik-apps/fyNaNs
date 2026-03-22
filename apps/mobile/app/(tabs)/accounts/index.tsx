import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { AccountList } from "@/src/components/accounts/AccountList";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";

export default function AccountsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refresh } = useApi<any[]>(() =>
    apiFetch("/api/accounts")
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  function handleAccountPress(id: string) {
    router.push(`/(tabs)/accounts/${id}`);
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

  if (!data?.length) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="No accounts yet"
          description="Link your bank account to get started"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <AccountList
        accounts={data}
        onAccountPress={handleAccountPress}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
