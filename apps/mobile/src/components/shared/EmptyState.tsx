import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {icon && (
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.primary + "15" },
          ]}
        >
          {icon}
        </View>
      )}
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text
        style={[styles.description, { color: theme.colors.textSecondary }]}
      >
        {description}
      </Text>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  description: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280,
  },
  action: { marginTop: 16 },
});
