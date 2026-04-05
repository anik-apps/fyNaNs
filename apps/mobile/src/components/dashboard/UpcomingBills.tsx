import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import { getBillStatus } from "@fynans/shared-types";
import { BILL_STATUS_COLORS } from "@/src/lib/bill-constants";

interface Bill {
  id: string;
  name: string;
  amount: number | string;
  next_due_date: string;
  is_auto_pay: boolean;
}


export function UpcomingBills({ bills }: { bills: Bill[] }) {
  const { theme } = useTheme();

  if (!bills?.length) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Upcoming Bills
      </Text>
      {bills.map((bill) => {
        const daysUntilDue = Math.ceil(
          (new Date(bill.next_due_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        );
        const status = getBillStatus(daysUntilDue, bill.is_auto_pay);
        const dotColor = BILL_STATUS_COLORS[status] || theme.colors.textSecondary;

        return (
          <View key={bill.id} style={styles.billRow}>
            <View
              style={[styles.statusDot, { backgroundColor: dotColor }]}
            />
            <View style={styles.billInfo}>
              <Text style={[styles.billName, { color: theme.colors.text }]}>
                {bill.name}
              </Text>
              <Text
                style={[styles.billDate, { color: theme.colors.textSecondary }]}
              >
                Due {formatDate(bill.next_due_date)}
              </Text>
            </View>
            <Text style={[styles.billAmount, { color: theme.colors.text }]}>
              {formatCurrency(bill.amount)}
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
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  billInfo: { flex: 1 },
  billName: { fontSize: 14, fontWeight: "500" },
  billDate: { fontSize: 12, marginTop: 2 },
  billAmount: { fontSize: 14, fontWeight: "600" },
});
