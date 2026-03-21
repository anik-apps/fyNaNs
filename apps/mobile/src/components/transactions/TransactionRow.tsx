import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Clock } from "lucide-react-native";
import { formatCurrency } from "@/src/lib/utils";
import { getDisplayType } from "@/src/lib/transaction-utils";
import { getCategoryIcon, getCategoryIconBg } from "@/src/lib/category-icons";
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
  onPress?: () => void;
}

export function TransactionRow({
  date,
  description,
  merchant_name,
  amount,
  category_name,
  category_color,
  account_name,
  is_pending,
  onPress,
}: TransactionRowProps) {
  const { theme, isDark } = useTheme();
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

  const CategoryIcon = getCategoryIcon(category_name);
  const iconColor = category_color || "#6b7280";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      style={[
        styles.container,
        { borderBottomColor: isDark ? "#1f2937" : "#f3f4f6" },
        is_pending && styles.pending,
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: getCategoryIconBg(iconColor) },
        ]}
      >
        {is_pending ? (
          <Clock color={iconColor} size={18} />
        ) : (
          <CategoryIcon color={iconColor} size={18} />
        )}
      </View>
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
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
            {category_name} · {account_name}
          </Text>
        </View>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {prefix}
        {formatCurrency(absAmount)}
      </Text>
    </TouchableOpacity>
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
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  info: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, fontWeight: "500", flex: 1 },
  pendingBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  pendingText: { fontSize: 10, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  meta: { fontSize: 12, flex: 1 },
  amount: { fontSize: 15, fontWeight: "600" },
});
