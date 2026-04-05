import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/src/lib/bill-constants";
import { useTheme } from "@/src/providers/ThemeProvider";
import {
  getBillStatus,
  BILL_FREQUENCY_LABELS,
  type BillFrequency,
} from "@fynans/shared-types";

interface BillCardProps {
  id: string;
  name: string;
  amount: string | number;
  frequency: BillFrequency;
  next_due_date: string;
  is_auto_pay: boolean;
  category_name?: string;
}


export function BillCard({
  name,
  amount,
  frequency,
  next_due_date,
  is_auto_pay,
  category_name,
}: BillCardProps) {
  const { theme } = useTheme();
  const daysUntilDue = Math.ceil(
    (new Date(next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const status = getBillStatus(daysUntilDue, is_auto_pay);
  const statusColor = BILL_STATUS_COLORS[status] || theme.colors.textSecondary;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {name}
          </Text>
          {category_name && (
            <Text
              style={[styles.category, { color: theme.colors.textSecondary }]}
            >
              {category_name}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {BILL_STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={[styles.amount, { color: theme.colors.text }]}>
          {formatCurrency(amount)}
        </Text>
        <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
          {BILL_FREQUENCY_LABELS[frequency]} · Due{" "}
          {formatDate(next_due_date)}
        </Text>
      </View>
    </View>
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
  category: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  details: { marginTop: 8 },
  amount: { fontSize: 20, fontWeight: "bold" },
  meta: { fontSize: 12, marginTop: 4 },
});
