import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { GoalStatus, PaceStatus } from "@fynans/shared-types";
import { useTheme } from "@/src/providers/ThemeProvider";

export interface GoalCardGoal {
  id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  progress_pct: number;
  pace_status: PaceStatus | null;
  status: GoalStatus;
  celebrated_at: string | null;
  linked_account: { id: string; name: string } | null;
  target_date: string | null;
}

const PACE_LABEL: Record<PaceStatus, string> = {
  ahead: "Ahead",
  on_pace: "On pace",
  behind: "Behind",
  target_passed: "Target passed",
};

const PACE_COLOR: Record<PaceStatus, string> = {
  ahead: "#10B981",
  on_pace: "#3B82F6",
  behind: "#F59E0B",
  target_passed: "#EF4444",
};

export function GoalCard({ goal, onPress }: { goal: GoalCardGoal; onPress: () => void }) {
  const { theme } = useTheme();
  const isCelebration = goal.status === "completed" && goal.celebrated_at === null;

  const bg = isCelebration ? "#FEF3C7" : theme.colors.card;
  const border = isCelebration ? "#F59E0B" : theme.colors.border;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: bg, borderColor: border }]}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {goal.name}
            </Text>
            {isCelebration && (
              <View style={styles.reachedBadge}>
                <Text style={styles.reachedText}>🎉 REACHED</Text>
              </View>
            )}
          </View>
          <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
            {goal.linked_account ? `Linked · ${goal.linked_account.name}` : "Manual"}
            {goal.target_date ? ` · Target ${goal.target_date}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.amount, { color: theme.colors.text }]}>
            ${Number(goal.current_amount).toFixed(2)}
          </Text>
          <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
            of ${Number(goal.target_amount).toFixed(2)} · {goal.progress_pct}%
          </Text>
        </View>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.skeleton }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, goal.progress_pct)}%`, backgroundColor: theme.colors.primary },
          ]}
        />
      </View>
      {goal.pace_status && (
        <Text style={[styles.pace, { color: PACE_COLOR[goal.pace_status] }]}>
          {PACE_LABEL[goal.pace_status]}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  sub: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "600" },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  pace: { marginTop: 6, fontSize: 12, fontWeight: "500" },
  reachedBadge: { backgroundColor: "#F59E0B", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  reachedText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
});
