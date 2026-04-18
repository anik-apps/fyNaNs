import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { PaceStatus } from "@fynans/shared-types";
import { useTheme } from "@/src/providers/ThemeProvider";

export interface GoalDashboardItem {
  id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  progress_pct: number;
  pace_status: PaceStatus | null;
  target_date: string | null;
}

export function GoalsNeedingAttentionCard({
  topGoals,
  activeCount,
}: {
  topGoals: GoalDashboardItem[];
  activeCount: number;
}) {
  const { theme } = useTheme();
  const router = useRouter();

  if (activeCount === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Savings Goals</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>No active goals yet.</Text>
        <Pressable onPress={() => router.push("/goals/new")}>
          <Text style={{ color: theme.colors.primary, marginTop: 8 }}>Set a goal →</Text>
        </Pressable>
      </View>
    );
  }

  const attention = topGoals.filter((g) => g.pace_status === "behind" || g.pace_status === "target_passed");

  if (attention.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Savings Goals</Text>
        <Text style={{ color: theme.colors.success, marginTop: 4 }}>
          ✓ All {activeCount} goal{activeCount === 1 ? "" : "s"} on track
        </Text>
        <Pressable onPress={() => router.push("/goals")}>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 8, fontSize: 12 }}>View all →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Goals Needing Attention</Text>
        <Pressable onPress={() => router.push("/goals")}>
          <Text style={{ color: theme.colors.primary, fontSize: 12 }}>View all →</Text>
        </Pressable>
      </View>
      {topGoals.map((g) => (
        <Pressable key={g.id} onPress={() => router.push(`/goals/${g.id}`)} style={{ marginTop: 10 }}>
          <View style={styles.row}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{g.name}</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{g.progress_pct}%</Text>
          </View>
          <View style={[styles.bar, { backgroundColor: theme.colors.skeleton }]}>
            <View style={{ width: `${Math.min(100, g.progress_pct)}%`, height: "100%", backgroundColor: theme.colors.primary, borderRadius: 3 }} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "600" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 14, flexShrink: 1 },
  bar: { height: 5, borderRadius: 3, marginTop: 4, overflow: "hidden" },
});
