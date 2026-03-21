import React from "react";
import { SectionList, Text, StyleSheet, View } from "react-native";
import { AccountCard } from "./AccountCard";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { AccountType } from "@fynans/shared-types";

interface Account {
  id: string;
  name: string;
  official_name: string | null;
  type: AccountType;
  balance: string | number;
  institution_name: string | null;
}

interface AccountListProps {
  accounts: Account[];
  onAccountPress: (id: string) => void;
  refreshControl?: React.ReactElement;
  ListHeaderComponent?: React.ReactElement;
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

  return (
    <SectionList
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
          official_name={item.official_name}
          type={item.type}
          balance={item.balance}
          institution_name={null}
          onPress={onAccountPress}
        />
      )}
      refreshControl={refreshControl}
      ListHeaderComponent={ListHeaderComponent}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
});
