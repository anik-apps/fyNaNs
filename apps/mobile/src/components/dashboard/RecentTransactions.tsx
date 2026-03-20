import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { formatCurrency, formatDate, formatRelativeDate } from "@/src/lib/utils";
import { getDisplayType } from "@/src/lib/transaction-utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import { getCategoryIcon, getCategoryIconBg } from "@/src/lib/category-icons";

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string | number;
  category_name: string;
  category_color?: string;
}

interface DateGroup {
  label: string;
  transactions: Transaction[];
}

function getDateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatDate(d);
}

function groupByDate(transactions: Transaction[]): DateGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const label = getDateGroupLabel(tx.date);
    const existing = groups.get(label);
    if (existing) {
      existing.push(tx);
    } else {
      groups.set(label, [tx]);
    }
  }
  return Array.from(groups.entries()).map(([label, txns]) => ({
    label,
    transactions: txns,
  }));
}

export function RecentTransactions({
  transactions,
  onSeeAll,
}: {
  transactions: Transaction[];
  onSeeAll?: () => void;
}) {
  const { theme } = useTheme();

  const dateGroups = useMemo(
    () => groupByDate(transactions.slice(0, 10)),
    [transactions]
  );

  if (!transactions?.length) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card }]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Recent Transactions
        </Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
              See All →
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {dateGroups.map((group) => (
        <View key={group.label}>
          <Text
            style={[
              styles.dateHeader,
              { color: theme.colors.textSecondary },
            ]}
          >
            {group.label}
          </Text>
          {group.transactions.map((tx) => {
            const numAmount =
              typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
            const absAmount = Math.abs(numAmount);
            const displayType = getDisplayType(numAmount, tx.category_name);
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
            const CategoryIcon = getCategoryIcon(tx.category_name);

            return (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.iconBadge, { backgroundColor: getCategoryIconBg(tx.category_color || '#6b7280') }]}>
                  <CategoryIcon color={tx.category_color || '#6b7280'} size={16} />
                </View>
                <View style={styles.txInfo}>
                  <Text
                    style={[styles.txName, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {tx.merchant_name || tx.description}
                  </Text>
                  <View style={styles.txMetaRow}>
                    <Text
                      style={[styles.txMeta, { color: theme.colors.textSecondary }]}
                    >
                      {tx.category_name}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.txAmount, { color: amountColor }]}>
                  {prefix}
                  {formatCurrency(absAmount)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: "600" },
  seeAll: { fontSize: 13, fontWeight: '500' },
  dateHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txInfo: { flex: 1, marginRight: 12 },
  txName: { fontSize: 14, fontWeight: "500" },
  txMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  txMeta: { fontSize: 12 },
  txAmount: { fontSize: 14, fontWeight: "600" },
});
