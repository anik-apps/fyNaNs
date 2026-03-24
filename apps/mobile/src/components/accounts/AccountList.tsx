import React from "react";
import { SectionList, Text, StyleSheet, View } from "react-native";
import { AccountCard } from "./AccountCard";
import { useTheme } from "@/src/providers/ThemeProvider";
import { formatCurrency } from "@/src/lib/utils";
import {
  ASSET_ACCOUNT_TYPES,
  LIABILITY_ACCOUNT_TYPES,
  type Account,
} from "@fynans/shared-types";

interface AccountListProps {
  accounts: Account[];
  onAccountPress: (id: string) => void;
  refreshControl?: React.ReactElement;
  ListHeaderComponent?: React.ReactElement;
}

function toNumber(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? 0 : n;
}

function SummaryHeader({ accounts }: { accounts: Account[] }) {
  const { theme } = useTheme();

  const assets = accounts
    .filter((a) => (ASSET_ACCOUNT_TYPES as readonly string[]).includes(a.type))
    .reduce((sum, a) => sum + toNumber(a.balance), 0);

  const liabilities = accounts
    .filter((a) => (LIABILITY_ACCOUNT_TYPES as readonly string[]).includes(a.type))
    .reduce((sum, a) => sum + toNumber(a.balance), 0);

  const netWorth = assets - liabilities;

  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: theme.colors.card },
      ]}
    >
      <View style={styles.summaryCol}>
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
          Assets
        </Text>
        <Text style={[styles.summaryValue, { color: "#22c55e" }]}>
          {formatCurrency(assets)}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.summaryCol}>
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
          Liabilities
        </Text>
        <Text style={[styles.summaryValue, { color: theme.colors.error }]}>
          {formatCurrency(liabilities)}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.summaryCol}>
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
          Net Worth
        </Text>
        <Text
          style={[
            styles.summaryValue,
            { color: netWorth >= 0 ? theme.colors.text : theme.colors.error },
          ]}
        >
          {formatCurrency(netWorth)}
        </Text>
      </View>
    </View>
  );
}

export function AccountList({
  accounts,
  onAccountPress,
  refreshControl,
  ListHeaderComponent,
}: AccountListProps) {
  const { theme } = useTheme();

  // Group by institution
  const grouped = accounts.reduce<Record<string, Account[]>>((acc, account) => {
    const key = account.institution_name || "Manual";
    if (!acc[key]) acc[key] = [];
    acc[key].push(account);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([title, data]) => ({
    title,
    data,
  }));

  const header = (
    <View>
      <SummaryHeader accounts={accounts} />
      {ListHeaderComponent}
    </View>
  );

  return (
    <SectionList
      style={{ flex: 1 }}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <View
          style={[
            styles.sectionHeader,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <AccountCard
          id={item.id}
          name={item.name}
          type={item.type}
          balance={item.balance}
          institution_name={null}
          is_manual={item.is_manual}
          plaid_item_id={item.plaid_item_id}
          last_synced_at={item.last_synced_at}
          onPress={onAccountPress}
        />
      )}
      refreshControl={refreshControl}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 80 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  summaryCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  divider: {
    width: 1,
    marginVertical: 4,
  },
});
