import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { formatRelativeTime } from "@/src/lib/utils";

interface NotificationRowProps {
  id: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  onPress: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  budget_80: "Budget at 80%",
  budget_100: "Budget exceeded",
  bill_reminder: "Bill reminder",
  bill_overdue: "Bill overdue",
};

export function NotificationRow({
  id,
  type,
  message,
  readAt,
  createdAt,
  onPress,
}: NotificationRowProps) {
  const { theme } = useTheme();
  const isUnread = !readAt;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isUnread
            ? theme.colors.surface
            : theme.colors.background,
          borderBottomColor: theme.colors.border,
        },
      ]}
      onPress={() => onPress(id)}
    >
      {isUnread && (
        <View
          style={[styles.dot, { backgroundColor: theme.colors.primary }]}
        />
      )}
      <View style={styles.content}>
        <Text style={[styles.message, { color: theme.colors.text }]}>
          {message || TYPE_LABELS[type] || type.replace(/_/g, " ")}
        </Text>
        <Text
          style={[styles.time, { color: theme.colors.textSecondary }]}
        >
          {formatRelativeTime(createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  content: { flex: 1 },
  message: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12, marginTop: 4 },
});
