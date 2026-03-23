import React, { useState, useEffect } from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@/src/providers/ThemeProvider";
import { apiFetch } from "@/src/lib/api-client";

export default function DevSettingsScreen() {
  const { theme } = useTheme();
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ enabled: boolean }>("/api/dev/sandbox-toggle")
      .then((data) => setSandboxEnabled(data.enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleSandbox(value: boolean) {
    setSaving(true);
    try {
      const data = await apiFetch<{ enabled: boolean }>("/api/dev/sandbox-toggle", {
        method: "POST",
        body: JSON.stringify({ enabled: value }),
      });
      setSandboxEnabled(data.enabled);
    } catch {
      setSandboxEnabled(!value);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: "Dev Settings" }} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: "Dev Settings" }} />
      <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Use Plaid Sandbox</Text>
          <Text style={[styles.sublabel, { color: theme.colors.textSecondary }]}>
            Link test bank accounts with fake data
          </Text>
        </View>
        <Switch
          value={sandboxEnabled}
          onValueChange={toggleSandbox}
          disabled={saving}
          trackColor={{ true: theme.colors.primary }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  labelContainer: { flex: 1, marginRight: 12 },
  label: { fontSize: 15, fontWeight: "500" },
  sublabel: { fontSize: 12, marginTop: 2 },
});
