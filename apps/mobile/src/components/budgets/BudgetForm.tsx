import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { BUDGET_PERIODS, BUDGET_PERIOD_LABELS } from "@fynans/shared-types";

interface BudgetFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    category_name: string;
    limit_amount: number;
    period: string;
  }) => void;
}

export function BudgetForm({ visible, onClose, onSubmit }: BudgetFormProps) {
  const { theme } = useTheme();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<string>("monthly");

  function handleSubmit() {
    if (!category || !amount) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    onSubmit({
      category_name: category,
      limit_amount: numAmount,
      period,
    });
    setCategory("");
    setAmount("");
    setPeriod("monthly");
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[styles.header, { borderBottomColor: theme.colors.border }]}
        >
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancel, { color: theme.colors.primary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            New Budget
          </Text>
          <TouchableOpacity onPress={handleSubmit}>
            <Text style={[styles.save, { color: theme.colors.primary }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Category
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Food & Drink"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Budget Amount
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Period
            </Text>
            <View style={styles.periodRow}>
              {BUDGET_PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.periodBtn,
                    {
                      backgroundColor:
                        period === p ? theme.colors.primary : theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={{
                      color:
                        period === p
                          ? theme.colors.primaryText
                          : theme.colors.text,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    {BUDGET_PERIOD_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  cancel: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: "600" },
  save: { fontSize: 16, fontWeight: "600" },
  body: { flex: 1, padding: 16 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  periodRow: { flexDirection: "row", gap: 8 },
  periodBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
});
