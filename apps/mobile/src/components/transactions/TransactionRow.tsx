import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency, formatRelativeDate } from "@/src/lib/utils";
import { getDisplayType } from "@/src/lib/transaction-utils";
import { useTheme } from "@/src/providers/ThemeProvider";

interface TransactionRowProps {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string | number;
  category_name: string;
  category_color?: string;
  account_name: string;
  is_pending: boolean;
}

export function TransactionRow({
  date,
  description,
  merchant_name,
  amount,
  category_name,
  account_name,
  is_pending,
}: TransactionRowProps) {
  const { theme } = useTheme();
  const numAmount =
    typeof amount === "string" ? parseFloat(amount) : amount;
  const absAmount = Math.abs(numAmount);
  const displayType = getDisplayType(numAmount, category_name);

  const amountColor =
    displayType === "income"
      ? theme.colors.success
      : displayType === "expense"
      ? theme.colors.error
      : theme.colors.textSecondary;
  const prefix =
    displayType === "income"
      ? "+"
      : displayType === "expense"
      ? "-"
      : "";

  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: theme.colors.border },
        is_pending && styles.pending,
      ]}
    >
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {merchant_name || description}
          </Text>
          {is_pending && (
            <View
              style={[
                styles.pendingBadge,
                { backgroundColor: theme.colors.skeleton },
              ]}
            >
              <Text style={[styles.pendingText, { color: theme.colors.textSecondary }]}>
                Pending
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
          {category_name} · {account_name} · {formatRelativeDate(date)}
        </Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {prefix}
        {formatCurrency(absAmount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  pending: { opacity: 0.6 },
  info: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 14, fontWeight: "500", flex: 1 },
  pendingBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  pendingText: { fontSize: 10, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "600" },
});
