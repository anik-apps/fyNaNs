import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Plus, Receipt } from "lucide-react-native";
import { BillCard } from "@/src/components/bills/BillCard";
import { BillForm } from "@/src/components/bills/BillForm";
import { EmptyState } from "@/src/components/shared/EmptyState";
import { ErrorView } from "@/src/components/shared/ErrorView";
import { useApi } from "@/src/hooks/useApi";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";

export default function BillsScreen() {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming">("all");

  const { data, isLoading, error, refresh } = useApi<any[]>(() =>
    apiFetch("/api/bills")
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  async function handleCreateBill(billData: any) {
    try {
      await apiFetch("/api/bills", {
        method: "POST",
        body: JSON.stringify(billData),
      });
      refresh();
    } catch {
      // Error handled by the form
    }
  }

  const filteredBills =
    filter === "upcoming"
      ? (data || []).filter((bill: any) => {
          const daysUntilDue = Math.ceil(
            (new Date(bill.next_due_date).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          );
          return daysUntilDue >= 0 && daysUntilDue <= 30;
        })
      : data || [];

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ErrorView message={error.message} onRetry={refresh} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Segment control — only shown when there are bills */}
      {(data?.length ?? 0) > 0 && (
        <View
          style={[styles.segmentRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          {(["all", "upcoming"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor:
                    filter === f ? theme.colors.primary : "transparent",
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={{
                  color:
                    filter === f
                      ? theme.colors.primaryText
                      : theme.colors.text,
                  fontWeight: "500",
                  fontSize: 14,
                }}
              >
                {f === "all" ? "All" : "Upcoming"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={filteredBills}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <BillCard
            id={item.id}
            name={item.name}
            amount={item.amount}
            frequency={item.frequency}
            next_due_date={item.next_due_date}
            is_auto_pay={item.is_auto_pay}
            category_name={item.category_name}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={<Receipt color={theme.colors.primary} size={32} />}
            title="No bills yet"
            description="Track recurring bills and never miss a payment"
            action={
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowForm(true)}
              >
                <Text style={styles.addBtnText}>Add Bill</Text>
              </TouchableOpacity>
            }
          />
        }
      />

      {(data?.length ?? 0) > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowForm(true)}
        >
          <Plus color="#FFF" size={24} />
        </TouchableOpacity>
      )}

      <BillForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreateBill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  segmentRow: {
    flexDirection: "row",
    margin: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    padding: 10,
    alignItems: "center",
  },
  list: { paddingBottom: 80 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
});
