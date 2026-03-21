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
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
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
  const [isLinking, setIsLinking] = useState(false);

  const { data, isLoading, error, refresh } = useApi<any[]>(() =>
    apiFetch("/api/accounts")
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  function handleAccountPress(id: string) {
    router.push(`/(tabs)/accounts/${id}`);
  }

  async function handleLinkBank() {
    if (isLinking) return;
    setIsLinking(true);
    try {
      const result = await apiFetch<{ link_token: string }>(
        "/api/plaid/link-token",
        { method: "POST" }
      );
      // Navigate to the Plaid Link flow with the token
      router.push({
        pathname: "/(modals)/plaid-link",
        params: { link_token: result.link_token },
      } as any);
    } catch (err) {
      Alert.alert(
        "Connection Error",
        "Could not start bank linking. Please try again."
      );
    } finally {
      setIsLinking(false);
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

  if (!data?.length) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="No accounts yet"
          description="Link your bank account to get started"
          action={
            <TouchableOpacity
              style={[styles.linkBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleLinkBank}
              disabled={isLinking}
            >
              <Text style={styles.linkBtnText}>
                {isLinking ? "Connecting..." : "Link Bank Account"}
              </Text>
            </TouchableOpacity>
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
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleLinkBank}
        disabled={isLinking}
      >
        {isLinking ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Plus color="#FFF" size={24} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  linkBtn: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  linkBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
});
