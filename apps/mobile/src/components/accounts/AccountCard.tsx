import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@fynans/shared-types";
import { apiFetch } from "@/src/lib/api-client";

interface AccountCardProps {
  id: string;
  name: string;
  official_name: string | null;
  type: AccountType;
  balance: string | number;
  institution_name: string | null;
  is_manual?: boolean;
  plaid_item_id?: string | null;
  last_synced_at?: string | null;
  onPress: (id: string) => void;
}

const STALE_DAYS = 3;

function formatSyncTime(lastSynced: string | null): { text: string; isStale: boolean } {
  if (!lastSynced) return { text: "Never synced", isStale: true };
  const diff = Date.now() - new Date(lastSynced).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const isStale = days >= STALE_DAYS;
  if (days > 0) return { text: `Synced ${days}d ago`, isStale };
  if (hours > 0) return { text: `Synced ${hours}h ago`, isStale };
  return { text: "Synced just now", isStale: false };
}

async function handleSync(plaidItemId: string) {
  try {
    await apiFetch(`/api/plaid/items/${plaidItemId}/sync`, { method: "POST" });
  } catch (e: any) {
    Alert.alert("Sync Failed", e.message || "Could not sync account");
  }
}

const TYPE_BADGE_COLORS: Record<string, { text: string; bg: string }> = {
  checking: { text: "#3b82f6", bg: "#dbeafe" },
  savings: { text: "#22c55e", bg: "#d1fae5" },
  investment: { text: "#8b5cf6", bg: "#ede9fe" },
  loan: { text: "#ef4444", bg: "#fef2f2" },
  credit: { text: "#ef4444", bg: "#fef2f2" },
};

export function AccountCard({
  id,
  name,
  official_name,
  type,
  balance,
  institution_name,
  is_manual = true,
  plaid_item_id,
  last_synced_at,
  onPress,
}: AccountCardProps) {
  const { theme } = useTheme();
  const badgeColors = TYPE_BADGE_COLORS[type] || {
    text: theme.colors.textSecondary,
    bg: theme.colors.surface,
  };
  const isLiability = type === "credit" || type === "loan";
  const syncInfo = formatSyncTime(last_synced_at ?? null);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.card }]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[styles.name, { color: theme.colors.text }]}>
                {name}
              </Text>
              {!is_manual && (
                <Text style={styles.linkedBadge}>LINKED</Text>
              )}
            </View>
            {institution_name && (
              <Text style={[styles.institution, { color: theme.colors.textSecondary }]}>
                {institution_name}
              </Text>
            )}
            {!is_manual && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Text style={{ fontSize: 10, color: syncInfo.isStale ? "#f59e0b" : "#22c55e" }}>●</Text>
                <Text style={{ fontSize: 10, color: "#888" }}>{syncInfo.text}</Text>
                {syncInfo.isStale && plaid_item_id && (
                  <TouchableOpacity onPress={() => handleSync(plaid_item_id)}>
                    <Text style={{ fontSize: 10, color: "#0a85ea", marginLeft: 4 }}>↻ Sync</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {is_manual && (
              <Text style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Manual</Text>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors.text }]}>
              {ACCOUNT_TYPE_LABELS[type] || type}
            </Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text
            style={[
              styles.balance,
              { color: isLiability ? theme.colors.error : theme.colors.text },
            ]}
          >
            {formatCurrency(balance)}
          </Text>
          <ChevronRight size={16} color={theme.colors.textSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { flex: 1, marginRight: 12 },
  header: { marginBottom: 6 },
  name: { fontSize: 15, fontWeight: "600" },
  institution: { fontSize: 12, marginTop: 2 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: "500" },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  balance: { fontSize: 18, fontWeight: "bold" },
  linkedBadge: {
    fontSize: 7,
    fontWeight: "600",
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: "hidden",
    textTransform: "uppercase",
    marginLeft: 4,
  },
});
