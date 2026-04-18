import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH } from "@fynans/shared-types";
import type { GoalCardGoal } from "./GoalCard";

interface AccountSummary { id: string; name: string; type: string }

export interface GoalFormProps {
  editing?: GoalCardGoal & { notes: string | null };
  onSaved: () => void;
  onCancel: () => void;
}

export function GoalForm({ editing, onSaved, onCancel }: GoalFormProps) {
  const { theme } = useTheme();
  const [name, setName] = useState(editing?.name ?? "");
  const [target, setTarget] = useState(editing?.target_amount ?? "");
  const [targetDate, setTargetDate] = useState(editing?.target_date ?? "");
  const [linked, setLinked] = useState(editing?.linked_account?.id ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<AccountSummary[]>("/api/accounts")
      .then((all) => setAccounts(all.filter((a) => a.type === "checking" || a.type === "savings")))
      .catch(() => {});
  }, []);

  async function save() {
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = { name, target_amount: target };
    if (targetDate) body.target_date = targetDate;
    if (linked) body.linked_account_id = linked;
    if (notes) body.notes = notes;

    try {
      if (editing) {
        await apiFetch(`/api/goals/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/goals", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={[styles.label, { color: theme.colors.text }]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={MAX_NAME_LENGTH}
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
      />

      <Text style={[styles.label, { color: theme.colors.text }]}>Target amount</Text>
      <TextInput
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
      />

      <Text style={[styles.label, { color: theme.colors.text }]}>Target date (YYYY-MM-DD, optional)</Text>
      <TextInput
        value={targetDate}
        onChangeText={setTargetDate}
        placeholder="2026-12-31"
        placeholderTextColor={theme.colors.textSecondary}
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
      />

      <Text style={[styles.label, { color: theme.colors.text }]}>Linked account (optional)</Text>
      <View style={styles.accountList}>
        <Pressable
          onPress={() => setLinked("")}
          style={[styles.accountPill, !linked && { backgroundColor: theme.colors.primary }]}
        >
          <Text style={{ color: !linked ? "#FFF" : theme.colors.text }}>Unlinked</Text>
        </Pressable>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setLinked(a.id)}
            style={[styles.accountPill, linked === a.id && { backgroundColor: theme.colors.primary }]}
          >
            <Text style={{ color: linked === a.id ? "#FFF" : theme.colors.text }}>{a.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: theme.colors.text }]}>Notes (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        maxLength={MAX_NOTES_LENGTH}
        multiline
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, minHeight: 80 }]}
      />

      {error ? <Text style={{ color: theme.colors.error, marginTop: 8 }}>{error}</Text> : null}

      <View style={styles.buttons}>
        <Pressable
          onPress={onCancel}
          style={[styles.btn, { borderColor: theme.colors.border, borderWidth: 1 }]}
        >
          <Text style={{ color: theme.colors.text }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={submitting}
          style={[styles.btn, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={{ color: "#FFF" }}>{submitting ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  accountList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  accountPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
