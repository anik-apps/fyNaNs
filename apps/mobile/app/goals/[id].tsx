import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import ConfettiCannon from "react-native-confetti-cannon";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { GoalCardGoal } from "@/src/components/goals/GoalCard";

interface Contribution { id: string; contribution_date: string; amount: string; note: string | null }
interface GoalDetail extends GoalCardGoal { contributions: Contribution[]; notes: string | null }

declare const global: { __FYNANS_E2E?: boolean };

export default function GoalDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10));
  const [contribAmount, setContribAmount] = useState("");
  const [firedConfetti, setFiredConfetti] = useState(false);

  const reload = useCallback(async () => {
    try {
      const g = await apiFetch<GoalDetail>(`/api/goals/${id}`);
      setGoal(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  useEffect(() => {
    if (!goal) return;
    if (goal.status === "completed" && goal.celebrated_at === null && !firedConfetti && !global.__FYNANS_E2E) {
      setFiredConfetti(true);
    }
  }, [goal, firedConfetti]);

  if (error) return <View style={{ padding: 20 }}><Text style={{ color: theme.colors.error }}>Error: {error}</Text></View>;
  if (!goal) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const isCelebration = goal.status === "completed" && goal.celebrated_at === null;
  const canAddContributions = goal.linked_account === null && goal.status === "active";

  async function addContribution() {
    if (!contribAmount) return;
    await apiFetch(`/api/goals/${goal!.id}/contributions`, {
      method: "POST",
      body: JSON.stringify({ contribution_date: contribDate, amount: contribAmount }),
    });
    setContribAmount("");
    await reload();
  }

  async function delContribution(cid: string) {
    await apiFetch(`/api/goals/${goal!.id}/contributions/${cid}`, { method: "DELETE" });
    await reload();
  }

  async function acknowledge() {
    await apiFetch(`/api/goals/${goal!.id}/acknowledge`, { method: "POST" });
    await reload();
  }

  async function archive() {
    await apiFetch(`/api/goals/${goal!.id}/archive`, { method: "POST" });
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{goal.name}</Text>
        {goal.linked_account && (
          <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>
            Linked · {goal.linked_account.name}
          </Text>
        )}

        <Text style={[styles.amount, { color: theme.colors.text }]}>
          ${Number(goal.current_amount).toFixed(2)}{" "}
          <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: "normal" }}>
            of ${Number(goal.target_amount).toFixed(2)}
          </Text>
        </Text>

        <View style={[styles.progress, { backgroundColor: theme.colors.skeleton }]}>
          <View
            style={{
              width: `${Math.min(100, goal.progress_pct)}%`,
              height: "100%",
              backgroundColor: theme.colors.primary,
              borderRadius: 4,
            }}
          />
        </View>

        {isCelebration && (
          <View style={{ marginTop: 16, padding: 14, backgroundColor: "#FEF3C7", borderRadius: 10 }}>
            <Text style={{ fontWeight: "700", color: "#92400E" }}>🎉 Goal reached!</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable onPress={acknowledge} style={[styles.btn, { backgroundColor: "#F59E0B" }]}>
                <Text style={{ color: "#FFF" }}>Acknowledge</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/goals/${goal.id}/reopen`)} style={[styles.btn, { borderWidth: 1, borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text }}>Raise Target</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <Pressable onPress={() => router.push(`/goals/${goal.id}/edit`)} style={[styles.btn, { borderWidth: 1, borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.text }}>Edit</Text>
          </Pressable>
          {goal.status === "active" && (
            <Pressable onPress={archive} style={[styles.btn, { borderWidth: 1, borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text }}>Archive</Text>
            </Pressable>
          )}
        </View>

        {canAddContributions && (
          <View style={{ marginTop: 20, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10 }}>
            <Text style={{ fontWeight: "600", color: theme.colors.text, marginBottom: 10 }}>Contributions</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={contribDate}
                onChangeText={setContribDate}
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, flex: 1 }]}
              />
              <TextInput
                value={contribAmount}
                onChangeText={setContribAmount}
                placeholder="Amount"
                keyboardType="decimal-pad"
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, flex: 1 }]}
              />
              <Pressable onPress={addContribution} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: "#FFF" }}>Add</Text>
              </Pressable>
            </View>
            {goal.contributions.length === 0 ? (
              <Text style={{ color: theme.colors.textSecondary, marginTop: 10 }}>No contributions yet.</Text>
            ) : (
              goal.contributions.map((c) => (
                <View key={c.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                  <View>
                    <Text style={{ color: theme.colors.text, fontWeight: "500" }}>${Number(c.amount).toFixed(2)}</Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{c.contribution_date}{c.note ? ` · ${c.note}` : ""}</Text>
                  </View>
                  <Pressable onPress={() => delContribution(c.id)}>
                    <Text style={{ color: theme.colors.error }}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      {firedConfetti && <ConfettiCannon count={120} origin={{ x: -10, y: 0 }} fadeOut autoStart />}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700" },
  amount: { fontSize: 28, fontWeight: "700", marginTop: 12 },
  progress: { height: 8, borderRadius: 4, marginTop: 8, overflow: "hidden" },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
