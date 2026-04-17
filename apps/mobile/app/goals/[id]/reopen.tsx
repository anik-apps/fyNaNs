import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";

export default function ReopenScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/goals/${id}/reopen`, {
        method: "POST",
        body: JSON.stringify({ new_target_amount: target }),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 16 }}>
      <Stack.Screen options={{ title: "Raise Target" }} />
      <Text style={{ color: theme.colors.text, fontWeight: "600" }}>New target amount</Text>
      <TextInput
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, marginTop: 8 }]}
      />
      {error && <Text style={{ color: theme.colors.error, marginTop: 8 }}>{error}</Text>}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
        <Pressable onPress={() => router.back()} style={[styles.btn, { borderWidth: 1, borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} disabled={submitting} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: "#FFF" }}>{submitting ? "Saving…" : "Reopen"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
});
