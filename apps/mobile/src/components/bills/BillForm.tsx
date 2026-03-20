import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { BILL_FREQUENCIES, BILL_FREQUENCY_LABELS } from "@fynans/shared-types";

interface BillFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    amount: number;
    frequency: string;
    day_of_month: number;
    is_auto_pay: boolean;
    reminder_days: number;
  }) => void;
}

export function BillForm({ visible, onClose, onSubmit }: BillFormProps) {
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<string>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [isAutoPay, setIsAutoPay] = useState(false);
  const [reminderDays, setReminderDays] = useState("3");

  function handleSubmit() {
    if (!name || !amount) {
      Alert.alert("Error", "Please fill in name and amount");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    onSubmit({
      name,
      amount: numAmount,
      frequency,
      day_of_month: parseInt(dayOfMonth) || 1,
      is_auto_pay: isAutoPay,
      reminder_days: parseInt(reminderDays) || 3,
    });
    setName("");
    setAmount("");
    setFrequency("monthly");
    setDayOfMonth("1");
    setIsAutoPay(false);
    setReminderDays("3");
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
            New Bill
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
              Bill Name
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
              value={name}
              onChangeText={setName}
              placeholder="e.g., Netflix"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Amount
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
              Frequency
            </Text>
            <View style={styles.freqRow}>
              {BILL_FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.freqBtn,
                    {
                      backgroundColor:
                        frequency === f
                          ? theme.colors.primary
                          : theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => setFrequency(f)}
                >
                  <Text
                    style={{
                      color:
                        frequency === f
                          ? theme.colors.primaryText
                          : theme.colors.text,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    {BILL_FREQUENCY_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Day of Month
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
              value={dayOfMonth}
              onChangeText={setDayOfMonth}
              placeholder="1"
              keyboardType="number-pad"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Auto Pay
            </Text>
            <Switch
              value={isAutoPay}
              onValueChange={setIsAutoPay}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Reminder Days Before Due
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
              value={reminderDays}
              onChangeText={setReminderDays}
              placeholder="3"
              keyboardType="number-pad"
              placeholderTextColor={theme.colors.textSecondary}
            />
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
  freqRow: { flexDirection: "row", gap: 8 },
  freqBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
});
