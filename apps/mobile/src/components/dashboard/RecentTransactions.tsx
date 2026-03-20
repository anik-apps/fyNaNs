import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency, formatRelativeDate } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";

const INCOME_CATEGORIES = new Set([
  "Income",
  "Salary",
  "Freelance",
  "Other Income",
  "Investments",
]);
const TRANSFER_CATEGORIES = new Set(["Transfer"]);

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string | number;
  category_name: string;
  account_type?: string;
}

function getDisplayType(
  amount: number,
  categoryName: string,
  accountType: string
): "income" | "expense" | "transfer" {
  if (TRANSFER_CATEGORIES.has(categoryName)) return "transfer";
  if (INCOME_CATEGORIES.has(categoryName)) return "income";
  return amount < 0 ? "income" : "expense";
}

export function RecentTransactions({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const { theme } = useTheme();

  if (!transactions?.length) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Recent Transactions
      </Text>
      {transactions.slice(0, 10).map((tx) => {
        const numAmount =
          typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
        const absAmount = Math.abs(numAmount);
        const displayType = getDisplayType(
          numAmount,
          tx.category_name,
          tx.account_type || "checking"
        );
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
          <View key={tx.id} style={styles.txRow}>
            <View style={styles.txInfo}>
              <Text
                style={[styles.txName, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {tx.merchant_name || tx.description}
              </Text>
              <Text
                style={[styles.txMeta, { color: theme.colors.textSecondary }]}
              >
                {tx.category_name} · {formatRelativeDate(tx.date)}
              </Text>
            </View>
            <Text style={[styles.txAmount, { color: amountColor }]}>
              {prefix}
              {formatCurrency(absAmount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
  },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  txInfo: { flex: 1, marginRight: 12 },
  txName: { fontSize: 14, fontWeight: "500" },
  txMeta: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "600" },
});
