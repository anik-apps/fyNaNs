import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ConfettiCannon from "react-native-confetti-cannon";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { GoalCardGoal } from "@/src/components/goals/GoalCard";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { CardSkeleton } from "@/src/components/shared/LoadingSkeleton";
import { ErrorView } from "@/src/components/shared/ErrorView";

interface Contribution { id: string; contribution_date: string; amount: string; note: string | null }
interface GoalDetail extends GoalCardGoal { contributions: Contribution[]; notes: string | null }

declare const global: { __FYNANS_E2E?: boolean };

export default function GoalDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10));
  const [contribAmount, setContribAmount] = useState("");
  const [firedConfetti, setFiredConfetti] = useState(false);

  const { data: goal, error, refetch } = useQuery({
    queryKey: ["goals", id],
    queryFn: () => apiFetch<GoalDetail>(`/api/goals/${id}`),
  });
  useRefreshOnFocus(refetch);

  function invalidateGoalQueries() {
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    queryClient.invalidateQueries({ queryKey: ["goals", id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const addContribution = useMutation({
    mutationFn: () =>
      apiFetch(`/api/goals/${id}/contributions`, {
        method: "POST",
        body: JSON.stringify({ contribution_date: contribDate, amount: contribAmount }),
      }),
    onSuccess: () => {
      setContribAmount("");
      invalidateGoalQueries();
    },
    onError: (err) =>
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add contribution"),
  });

  const deleteContribution = useMutation({
    mutationFn: (cid: string) =>
      apiFetch(`/api/goals/${id}/contributions/${cid}`, { method: "DELETE" }),
    onSuccess: () => invalidateGoalQueries(),
    onError: (err) =>
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete contribution"),
  });

  const acknowledge = useMutation({
    mutationFn: () => apiFetch(`/api/goals/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => invalidateGoalQueries(),
    onError: (err) =>
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to acknowledge goal"),
  });

  const archive = useMutation({
    mutationFn: () => apiFetch(`/api/goals/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      invalidateGoalQueries();
      router.back();
    },
    onError: (err) =>
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to archive goal"),
  });

  useEffect(() => {
    if (!goal) return;
    if (goal.status === "completed" && goal.celebrated_at === null && !firedConfetti && !global.__FYNANS_E2E) {
      setFiredConfetti(true);
    }
  }, [goal, firedConfetti]);

  // Keep showing the cached goal if a background refetch fails.
  if (error && !goal) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorView message={error.message} onRetry={() => refetch()} />
      </View>
    );
  }
  if (!goal) {
    return (
      <View style={{ flex: 1, paddingTop: 12, backgroundColor: theme.colors.background }}>
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  }

  const isCelebration = goal.status === "completed" && goal.celebrated_at === null;
  const canAddContributions = goal.linked_account === null && goal.status === "active";

  function confirmDeleteContribution(cid: string) {
    Alert.alert("Delete contribution?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteContribution.mutate(cid),
      },
    ]);
  }

  function confirmArchive() {
    Alert.alert("Archive goal?", "The goal will no longer appear in your active goals.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: () => archive.mutate(),
      },
    ]);
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
              <Pressable
                onPress={() => acknowledge.mutate()}
                disabled={acknowledge.isPending}
                style={[styles.btn, { backgroundColor: "#F59E0B", opacity: acknowledge.isPending ? 0.6 : 1 }]}
              >
                <Text style={{ color: "#FFF" }}>{acknowledge.isPending ? "Acknowledging…" : "Acknowledge"}</Text>
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
            <Pressable
              onPress={confirmArchive}
              disabled={archive.isPending}
              style={[styles.btn, { borderWidth: 1, borderColor: theme.colors.border, opacity: archive.isPending ? 0.6 : 1 }]}
            >
              <Text style={{ color: theme.colors.text }}>{archive.isPending ? "Archiving…" : "Archive"}</Text>
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
              <Pressable
                onPress={() => {
                  if (!contribAmount || addContribution.isPending) return;
                  addContribution.mutate();
                }}
                disabled={addContribution.isPending}
                style={[styles.btn, { backgroundColor: theme.colors.primary, opacity: addContribution.isPending ? 0.6 : 1 }]}
              >
                {addContribution.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: "#FFF" }}>Add</Text>
                )}
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
                  <Pressable
                    onPress={() => confirmDeleteContribution(c.id)}
                    disabled={deleteContribution.isPending}
                  >
                    <Text style={{ color: theme.colors.error, opacity: deleteContribution.isPending ? 0.6 : 1 }}>
                      Delete
                    </Text>
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
