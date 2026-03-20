import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@fynans/shared-types";

interface AccountCardProps {
  id: string;
  name: string;
  official_name: string | null;
  type: AccountType;
  balance: string | number;
  institution_name: string | null;
  onPress: (id: string) => void;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  checking: "#3B82F6",
  savings: "#10B981",
  credit: "#F59E0B",
  loan: "#EF4444",
  investment: "#8B5CF6",
};

export function AccountCard({
  id,
  name,
  official_name,
  type,
  balance,
  institution_name,
  onPress,
}: AccountCardProps) {
  const { theme } = useTheme();
  const badgeColor = TYPE_BADGE_COLORS[type] || theme.colors.textSecondary;
  const isLiability = type === "credit" || type === "loan";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {name}
          </Text>
          {institution_name && (
            <Text style={[styles.institution, { color: theme.colors.textSecondary }]}>
              {institution_name}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>
            {ACCOUNT_TYPE_LABELS[type] || type}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.balance,
          { color: isLiability ? theme.colors.error : theme.colors.text },
        ]}
      >
        {formatCurrency(balance)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nameContainer: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, fontWeight: "600" },
  institution: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  balance: { fontSize: 22, fontWeight: "bold", marginTop: 8 },
});
