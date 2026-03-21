import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { ChevronLeft, Clock } from "lucide-react-native";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { formatCurrency } from "@/src/lib/utils";
import { getDisplayType } from "@/src/lib/transaction-utils";
import { getCategoryIcon, getCategoryIconBg } from "@/src/lib/category-icons";

interface TransactionDetail {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string | number;
  category_name: string;
  category_color?: string;
  account_name: string;
  is_pending: boolean;
  notes?: string | null;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();

  const { data: transaction, isLoading, error, refresh } = useApi<TransactionDetail>(
    () => apiFetch<TransactionDetail>(`/api/transactions/${id}`)
  );

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !transaction) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorView
          message={error?.message ?? "Transaction not found"}
          onRetry={refresh}
        />
      </View>
    );
  }

  const numAmount =
    typeof transaction.amount === "string"
      ? parseFloat(transaction.amount)
      : transaction.amount;
  const absAmount = Math.abs(numAmount);
  const displayType = getDisplayType(numAmount, transaction.category_name);

  const amountColor =
    displayType === "income"
      ? theme.colors.success
      : displayType === "expense"
      ? theme.colors.error
      : theme.colors.textSecondary;

  const prefix =
    displayType === "income" ? "+" : displayType === "expense" ? "-" : "";

  const CategoryIcon = getCategoryIcon(transaction.category_name);
  const iconColor = transaction.category_color || "#6b7280";

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Back header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft color={theme.colors.primary} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Transaction
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              shadowColor: theme.colors.text,
            },
          ]}
        >
          {/* Category icon badge */}
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: getCategoryIconBg(iconColor) },
              ]}
            >
              {transaction.is_pending ? (
                <Clock color={iconColor} size={28} />
              ) : (
                <CategoryIcon color={iconColor} size={28} />
              )}
            </View>
          </View>

          {/* Merchant / description */}
          <Text style={[styles.merchantName, { color: theme.colors.text }]}>
            {transaction.merchant_name || transaction.description}
          </Text>

          {/* Amount */}
          <Text style={[styles.amount, { color: amountColor }]}>
            {prefix}
            {formatCurrency(absAmount)}
          </Text>

          {/* Pending badge */}
          {transaction.is_pending && (
            <View
              style={[
                styles.pendingBadge,
                { backgroundColor: theme.colors.skeleton },
              ]}
            >
              <Clock color={theme.colors.textSecondary} size={12} />
              <Text
                style={[
                  styles.pendingText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Pending
              </Text>
            </View>
          )}
        </View>

        {/* Details card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              shadowColor: theme.colors.text,
            },
          ]}
        >
          {/* Date */}
          <View style={styles.row}>
            <Text
              style={[styles.rowLabel, { color: theme.colors.textSecondary }]}
            >
              Date
            </Text>
            <Text style={[styles.rowValue, { color: theme.colors.text }]}>
              {formatFullDate(transaction.date)}
            </Text>
          </View>

          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />

          {/* Category */}
          <View style={styles.row}>
            <Text
              style={[styles.rowLabel, { color: theme.colors.textSecondary }]}
            >
              Category
            </Text>
            <View style={styles.categoryValue}>
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: iconColor },
                ]}
              />
              <Text style={[styles.rowValue, { color: theme.colors.text }]}>
                {transaction.category_name}
              </Text>
            </View>
          </View>

          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />

          {/* Account */}
          <View style={styles.row}>
            <Text
              style={[styles.rowLabel, { color: theme.colors.textSecondary }]}
            >
              Account
            </Text>
            <Text style={[styles.rowValue, { color: theme.colors.text }]}>
              {transaction.account_name}
            </Text>
          </View>

          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />

          {/* Type */}
          <View style={styles.row}>
            <Text
              style={[styles.rowLabel, { color: theme.colors.textSecondary }]}
            >
              Type
            </Text>
            <Text style={[styles.rowValue, { color: amountColor }]}>
              {displayType.charAt(0).toUpperCase() + displayType.slice(1)}
            </Text>
          </View>
        </View>

        {/* Notes card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              shadowColor: theme.colors.text,
            },
          ]}
        >
          <Text
            style={[styles.notesLabel, { color: theme.colors.textSecondary }]}
          >
            Notes
          </Text>
          <Text
            style={[styles.notesPlaceholder, { color: theme.colors.textSecondary }]}
          >
            {transaction.notes ?? "No notes added yet."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36 },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantName: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  amount: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  categoryValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "flex-end",
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  divider: {
    height: 1,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  notesPlaceholder: {
    fontSize: 15,
    lineHeight: 22,
  },
});
