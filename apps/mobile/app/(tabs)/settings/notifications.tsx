import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";

interface NotificationSettings {
  email_bill_reminders: boolean;
  email_budget_alerts: boolean;
  push_bill_reminders: boolean;
  push_budget_alerts: boolean;
}

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const [settings, setSettings] = useState<NotificationSettings>({
    email_bill_reminders: true,
    email_budget_alerts: true,
    push_bill_reminders: true,
    push_budget_alerts: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch<any>("/api/user/settings")
      .then((data) => {
        if (data) {
          setSettings({
            email_bill_reminders: data.email_bill_reminders ?? true,
            email_budget_alerts: data.email_budget_alerts ?? true,
            push_bill_reminders: data.push_bill_reminders ?? true,
            push_budget_alerts: data.push_budget_alerts ?? true,
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function updateSetting(
    key: keyof NotificationSettings,
    value: boolean
  ) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      await apiFetch("/api/user/settings", {
        method: "PUT",
        body: JSON.stringify(updated),
      });
    } catch {
      setSettings(settings);
      Alert.alert("Error", "Failed to update settings");
    }
  }

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <Stack.Screen
          options={{ headerShown: true, title: "Notifications" }}
        />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const rows: {
    key: keyof NotificationSettings;
    label: string;
    section: string;
  }[] = [
    {
      key: "push_bill_reminders",
      label: "Bill Reminders",
      section: "Push Notifications",
    },
    {
      key: "push_budget_alerts",
      label: "Budget Alerts",
      section: "Push Notifications",
    },
    {
      key: "email_bill_reminders",
      label: "Bill Reminders",
      section: "Email Notifications",
    },
    {
      key: "email_budget_alerts",
      label: "Budget Alerts",
      section: "Email Notifications",
    },
  ];

  const sections = [
    {
      title: "Push Notifications",
      items: rows.filter((r) => r.section === "Push Notifications"),
    },
    {
      title: "Email Notifications",
      items: rows.filter((r) => r.section === "Email Notifications"),
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Stack.Screen
        options={{ headerShown: true, title: "Notifications" }}
      />

      {sections.map((section) => (
        <View key={section.title}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            {section.title}
          </Text>
          {section.items.map((item) => (
            <View
              key={item.key}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
                {item.label}
              </Text>
              <Switch
                value={settings[item.key]}
                onValueChange={(v) => updateSetting(item.key, v)}
                trackColor={{ true: theme.colors.primary }}
              />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 15 },
});
