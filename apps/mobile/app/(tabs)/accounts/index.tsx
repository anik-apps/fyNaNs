import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { AccountList } from "@/src/components/accounts/AccountList";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { createLinkToken, openPlaidLink } from "@/src/lib/plaid";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { CardSkeleton } from "@/src/components/shared/LoadingSkeleton";

export default function AccountsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiFetch<any[]>("/api/accounts"),
  });
  useRefreshOnFocus(refetch);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function handleAccountPress(id: string) {
    router.push(`/(tabs)/accounts/${id}`);
  }

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

  // Keep showing cached accounts if a background refetch fails.
  if (error && !data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ErrorView message={error.message} onRetry={() => refetch()} />
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
                      () => refetch(),
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
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/accounts/add")}
              style={{ marginRight: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Plus color={theme.colors.primary} size={24} />
            </TouchableOpacity>
          ),
        }}
      />
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
  skeletonWrap: { paddingTop: 12 },
  linkButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  linkButtonText: { fontSize: 15, fontWeight: "600" },
  manualLink: { fontSize: 13 },
});
