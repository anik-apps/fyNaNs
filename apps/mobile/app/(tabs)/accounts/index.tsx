import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { AccountList } from "@/src/components/accounts/AccountList";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { type Account } from "@fynans/shared-types";
import { useTheme } from "@/src/providers/ThemeProvider";
import { createLinkToken, openPlaidLink } from "@/src/lib/plaid";

export default function AccountsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refresh } = useApi<Account[]>(() =>
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
          description="Link your bank for automatic tracking"
          action={
            <View style={{ gap: 8, alignItems: "center" }}>
              <TouchableOpacity
                style={[styles.linkButton, { backgroundColor: theme.colors.primary }]}
                onPress={async () => {
                  try {
                    const token = await createLinkToken();
                    openPlaidLink(
                      token,
                      () => refresh(),
                      (err) => { if (err) Alert.alert("Error", err); }
                    );
                  } catch (e: any) {
                    Alert.alert("Error", e.message || "Failed to start bank link");
                  }
                }}
              >
                <Text style={[styles.linkButtonText, { color: theme.colors.primaryText }]}>
                  Link Bank Account
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/(tabs)/accounts/add")}>
                <Text style={[styles.manualLink, { color: theme.colors.primary }]}>
                  or add manually
                </Text>
              </TouchableOpacity>
            </View>
          }
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
  linkButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  linkButtonText: { fontSize: 15, fontWeight: "600" },
  manualLink: { fontSize: 13 },
});
