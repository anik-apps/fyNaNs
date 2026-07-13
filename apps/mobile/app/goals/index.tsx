import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl, Pressable, StyleSheet } from "react-native";
import { Plus, Target } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { GoalCard, type GoalCardGoal } from "@/src/components/goals/GoalCard";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { CardSkeleton } from "@/src/components/shared/LoadingSkeleton";

export default function GoalsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: active, isLoading, error, refetch } = useQuery({
    queryKey: ["goals", "active"],
    queryFn: () => apiFetch<GoalCardGoal[]>("/api/goals?status=active"),
  });
  useRefreshOnFocus(refetch);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, paddingTop: 12, backgroundColor: theme.colors.background }}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  }
  // Keep showing cached goals if a background refetch fails.
  if (error && !active) {
    return <ErrorView message={error.message} onRetry={() => refetch()} />;
  }

  if (!active || active.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <EmptyState
          icon={<Target size={48} color={theme.colors.textSecondary} />}
          title="No goals yet"
          description="Create your first savings goal to track progress."
        />
        <Pressable style={[styles.fab, { backgroundColor: theme.colors.primary }]} onPress={() => router.push("/goals/new")}>
          <Plus color="#FFF" size={24} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={active}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GoalCard goal={item} onPress={() => router.push(`/goals/${item.id}`)} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
      />
      <Pressable style={[styles.fab, { backgroundColor: theme.colors.primary }]} onPress={() => router.push("/goals/new")}>
        <Plus color="#FFF" size={24} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute", right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center", elevation: 4,
  },
});
