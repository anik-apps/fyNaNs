import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterValues) => void;
  initialFilters: FilterValues;
}

export interface FilterValues {
  search: string;
  category: string;
  dateFrom: string;
  dateTo: string;
}

export function FilterSheet({
  visible,
  onClose,
  onApply,
  initialFilters,
}: FilterSheetProps) {
  const { theme } = useTheme();
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  function handleApply() {
    onApply(filters);
    onClose();
  }

  function handleClear() {
    const cleared = { search: "", category: "", dateFrom: "", dateTo: "" };
    setFilters(cleared);
    onApply(cleared);
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
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancel, { color: theme.colors.primary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Filters
          </Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={[styles.clear, { color: theme.colors.error }]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Search
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
              value={filters.search}
              onChangeText={(search) => setFilters({ ...filters, search })}
              placeholder="Merchant, description..."
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

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
              value={filters.category}
              onChangeText={(category) =>
                setFilters({ ...filters, category })
              }
              placeholder="Filter by category..."
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.dateRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                From
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
                value={filters.dateFrom}
                onChangeText={(dateFrom) =>
                  setFilters({ ...filters, dateFrom })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                To
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
                value={filters.dateTo}
                onChangeText={(dateTo) =>
                  setFilters({ ...filters, dateTo })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleApply}
        >
          <Text style={styles.applyText}>Apply Filters</Text>
        </TouchableOpacity>
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
    borderBottomColor: "#E5E7EB",
  },
  cancel: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: "600" },
  clear: { fontSize: 16 },
  body: { flex: 1, padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dateRow: { flexDirection: "row", gap: 12 },
  applyBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  applyText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
