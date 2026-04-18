import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl, Pressable, StyleSheet, ActivityIndicator, Text } from "react-native";
import { Plus, Target } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { GoalCard, type GoalCardGoal } from "@/src/components/goals/GoalCard";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";

export default function GoalsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: active, isLoading, error, refresh } = useApi<GoalCardGoal[]>(() =>
    apiFetch("/api/goals?status=active")
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (isLoading && !active) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error) return <ErrorView message={String(error)} onRetry={refresh} />;

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
