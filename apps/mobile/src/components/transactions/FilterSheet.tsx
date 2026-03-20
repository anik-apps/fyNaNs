import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { apiFetch } from "@/src/lib/api-client";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterValues) => void;
  initialFilters: FilterValues;
}

export interface FilterValues {
  search: string;
  categoryId: string;
  categoryName: string;
  dateFrom: string;
  dateTo: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

const TIME_PRESETS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: 0 },
];

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function FilterSheet({
  visible,
  onClose,
  onApply,
  initialFilters,
}: FilterSheetProps) {
  const { theme } = useTheme();
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setFilters(initialFilters);
      // Detect active preset from initial date range
      if (initialFilters.dateFrom && !initialFilters.dateTo) {
        const daysDiff = Math.round(
          (Date.now() - new Date(initialFilters.dateFrom).getTime()) / 86400000
        );
        const match = TIME_PRESETS.find((p) => Math.abs(p.days - daysDiff) < 2);
        setActivePreset(match?.label || null);
      } else if (!initialFilters.dateFrom) {
        setActivePreset("All");
      }
    }
  }, [visible, initialFilters]);

  useEffect(() => {
    if (visible && categories.length === 0) {
      apiFetch<Category[]>("/api/categories/with-transactions")
        .then((data) => {
          setCategories(data);
        })
        .catch(() => {});
    }
  }, [visible, categories.length]);

  function handlePreset(label: string, days: number) {
    setActivePreset(label);
    if (days === 0) {
      setFilters({ ...filters, dateFrom: "", dateTo: "" });
    } else {
      const from = new Date();
      from.setDate(from.getDate() - days);
      setFilters({ ...filters, dateFrom: formatDate(from), dateTo: "" });
    }
  }

  function handleSelectCategory(cat: Category | null) {
    setFilters({ ...filters, categoryId: cat?.id || "", categoryName: cat?.name || "" });
    setShowCategoryPicker(false);
  }

  function handleApply() {
    onApply(filters);
    onClose();
  }

  function handleClear() {
    const cleared = { search: "", categoryId: "", categoryName: "", dateFrom: "", dateTo: "" };
    setFilters(cleared);
    setActivePreset("All");
    onApply(cleared);
    onClose();
  }

  const selectedCategory = categories.find((c) => c.id === filters.categoryId);

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
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
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
          {/* Search */}
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

          {/* Category Dropdown */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Category
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <View style={styles.dropdownContent}>
                {selectedCategory && (
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: selectedCategory.color },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.dropdownText,
                    {
                      color: filters.categoryId
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    },
                  ]}
                >
                  {filters.categoryName || "All categories"}
                </Text>
              </View>
              {showCategoryPicker ? (
                <ChevronUp color={theme.colors.textSecondary} size={16} />
              ) : (
                <ChevronDown color={theme.colors.textSecondary} size={16} />
              )}
            </TouchableOpacity>

            {showCategoryPicker && (
              <View
                style={[
                  styles.pickerList,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => handleSelectCategory(null)}
                >
                  <Text style={[styles.pickerItemText, { color: theme.colors.text }]}>
                    All categories
                  </Text>
                </TouchableOpacity>
                {categories.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.pickerItem, { borderBottomColor: theme.colors.border }]}
                      onPress={() => handleSelectCategory(item)}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                      <Text
                        style={[
                          styles.pickerItemText,
                          {
                            color: theme.colors.text,
                            fontWeight: item.id === filters.categoryId ? "700" : "400",
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Time Period Quick Filters */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Time Period
            </Text>
            <View style={styles.presetRow}>
              {TIME_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.presetButton,
                    activePreset === preset.label
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => handlePreset(preset.label, preset.days)}
                >
                  <Text
                    style={[
                      styles.presetLabel,
                      {
                        color:
                          activePreset === preset.label
                            ? theme.colors.primaryText
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Custom Date Range (collapsed by default, show if no preset active) */}
          {activePreset === null && (
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
                  onChangeText={(dateFrom) => {
                    setFilters({ ...filters, dateFrom });
                    setActivePreset(null);
                  }}
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
                  onChangeText={(dateTo) => {
                    setFilters({ ...filters, dateTo });
                    setActivePreset(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
            </View>
          )}
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
  },
  cancel: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: "600" },
  clear: { fontSize: 16 },
  body: { flex: 1, padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownText: { fontSize: 16 },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pickerList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: "hidden",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemText: { fontSize: 15 },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  presetLabel: { fontSize: 13, fontWeight: "600" },
  dateRow: { flexDirection: "row", gap: 12 },
  applyBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  applyText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
