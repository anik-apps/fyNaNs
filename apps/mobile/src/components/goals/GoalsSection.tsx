import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { GoalCard, type GoalCardGoal } from "./GoalCard";

export function GoalsSection() {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: goals } = useApi<GoalCardGoal[]>(() => apiFetch("/api/goals?status=active"));

  const top = (goals ?? []).slice(0, 3);

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Savings Goals</Text>
        <Pressable onPress={() => router.push("/goals")}>
          <View style={styles.viewAll}>
            <Text style={{ color: theme.colors.primary, fontSize: 14 }}>View all</Text>
            <ChevronRight color={theme.colors.primary} size={16} />
          </View>
        </Pressable>
      </View>
      {top.length === 0 ? (
        <Pressable
          onPress={() => router.push("/goals/new")}
          style={[styles.emptyCta, { borderColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.textSecondary }}>Create your first goal →</Text>
        </Pressable>
      ) : (
        top.map((g) => (
          <GoalCard key={g.id} goal={g} onPress={() => router.push(`/goals/${g.id}`)} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "600" },
  viewAll: { flexDirection: "row", alignItems: "center" },
  emptyCta: { borderWidth: 1, borderStyle: "dashed", borderRadius: 8, padding: 16, alignItems: "center" },
});
