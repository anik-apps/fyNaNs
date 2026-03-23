import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/src/providers/ThemeProvider";
import { apiFetch } from "@/src/lib/api-client";
import { createLinkToken, openPlaidLink } from "@/src/lib/plaid";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "loan", label: "Loan" },
  { value: "investment", label: "Investment" },
];

export default function AddAccountScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState("checking");
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);

  async function handleLinkBank() {
    setLinking(true);
    try {
      const linkToken = await createLinkToken();
      openPlaidLink(
        linkToken,
        (_result) => {
          setLinking(false);
          router.back();
        },
        (error) => {
          setLinking(false);
          if (error) Alert.alert("Link Failed", error);
        }
      );
    } catch (e: any) {
      setLinking(false);
      Alert.alert("Error", e.message || "Failed to start bank link");
    }
  }

  async function handleSave() {
    if (!name.trim() || !institution.trim()) {
      Alert.alert("Missing fields", "Name and institution are required.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          institution_name: institution.trim(),
          type,
          balance: balance.trim() || "0",
        }),
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: "Add Account" }} />
      <ScrollView contentContainerStyle={styles.form}>
        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleLinkBank}
          disabled={linking}
        >
          {linking ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <Text style={[styles.linkButtonText, { color: theme.colors.primaryText }]}>
              Link Bank Account
            </Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.divider, { color: theme.colors.textSecondary }]}>or add manually</Text>
        <Text style={[styles.label, { color: theme.colors.text }]}>Account Name</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          placeholder="e.g. Main Checking"
          placeholderTextColor={theme.colors.textSecondary}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>Institution</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          placeholder="e.g. Chase, Bank of America"
          placeholderTextColor={theme.colors.textSecondary}
          value={institution}
          onChangeText={setInstitution}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>Account Type</Text>
        <View style={styles.typeRow}>
          {ACCOUNT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[
                styles.typeChip,
                {
                  backgroundColor: type === t.value ? theme.colors.primary : theme.colors.card,
                  borderColor: type === t.value ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setType(t.value)}
            >
              <Text
                style={[
                  styles.typeText,
                  { color: type === t.value ? theme.colors.primaryText : theme.colors.text },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.colors.text }]}>Current Balance</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textSecondary}
          value={balance}
          onChangeText={setBalance}
          keyboardType="decimal-pad"
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <Text style={[styles.saveText, { color: theme.colors.primaryText }]}>
              Add Account
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 16, gap: 4 },
  label: { fontSize: 14, fontWeight: "500", marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 6,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeText: { fontSize: 13, fontWeight: "500" },
  saveButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: { fontSize: 16, fontWeight: "600" },
  linkButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  linkButtonText: { fontSize: 16, fontWeight: "600" },
  divider: { textAlign: "center", fontSize: 13, marginVertical: 12 },
});
