import React from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Shield,
  Bell,
  Fingerprint,
  Download,
  Trash2,
  LogOut,
  ChevronRight,
} from "lucide-react-native";
import { useAuth } from "@/src/hooks/useAuth";
import { useBiometric } from "@/src/hooks/useBiometric";
import { useTheme } from "@/src/providers/ThemeProvider";
import { apiFetch } from "@/src/lib/api-client";

export default function SettingsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isAvailable, isEnabled, biometricType, enable, disable } =
    useBiometric();

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch("/api/user/delete", { method: "DELETE" });
              await logout();
            } catch {
              Alert.alert("Error", "Failed to delete account");
            }
          },
        },
      ]
    );
  }

  async function handleExportData() {
    try {
      await apiFetch("/api/user/export", { method: "POST" });
      Alert.alert("Export Requested", "You will receive an email with your data export.");
    } catch {
      Alert.alert("Error", "Failed to request data export");
    }
  }

  const sections = [
    {
      title: "Account",
      data: [
        {
          key: "profile",
          icon: User,
          label: "Profile",
          onPress: () => router.push("/(tabs)/settings/profile"),
        },
        {
          key: "security",
          icon: Shield,
          label: "Security",
          onPress: () => router.push("/(tabs)/settings/security"),
        },
        {
          key: "notifications",
          icon: Bell,
          label: "Notifications",
          onPress: () => router.push("/(tabs)/settings/notifications"),
        },
      ],
    },
    ...(isAvailable
      ? [
          {
            title: "Privacy",
            data: [
              {
                key: "biometric",
                icon: Fingerprint,
                label: `${biometricType || "Biometric"} Lock`,
                isToggle: true,
                value: isEnabled,
                onToggle: () => (isEnabled ? disable() : enable()),
              },
            ],
          },
        ]
      : []),
    {
      title: "Data",
      data: [
        {
          key: "export",
          icon: Download,
          label: "Export Data",
          onPress: handleExportData,
        },
        {
          key: "delete",
          icon: Trash2,
          label: "Delete Account",
          destructive: true,
          onPress: handleDeleteAccount,
        },
      ],
    },
    {
      title: "",
      data: [
        {
          key: "logout",
          icon: LogOut,
          label: "Sign Out",
          destructive: true,
          onPress: handleLogout,
        },
      ],
    },
  ];

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item: any) => item.key}
      style={{ backgroundColor: theme.colors.surface }}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              {section.title}
            </Text>
          </View>
        ) : (
          <View style={{ height: 24 }} />
        )
      }
      renderItem={({ item }: { item: any }) => {
        const Icon = item.icon;
        return (
          <TouchableOpacity
            style={[
              styles.row,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={item.isToggle ? undefined : item.onPress}
            disabled={item.isToggle}
            activeOpacity={item.isToggle ? 1 : 0.7}
          >
            <Icon
              color={
                item.destructive
                  ? theme.colors.error
                  : theme.colors.textSecondary
              }
              size={20}
            />
            <Text
              style={[
                styles.rowLabel,
                {
                  color: item.destructive
                    ? theme.colors.error
                    : theme.colors.text,
                },
              ]}
            >
              {item.label}
            </Text>
            {item.isToggle ? (
              <Switch
                value={item.value}
                onValueChange={item.onToggle}
                trackColor={{ true: theme.colors.primary }}
              />
            ) : (
              <ChevronRight
                color={theme.colors.textSecondary}
                size={18}
              />
            )}
          </TouchableOpacity>
        );
      }}
      ListHeaderComponent={
        user ? (
          <View
            style={[
              styles.userCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.userName, { color: theme.colors.text }]}>
                {user.name}
              </Text>
              <Text
                style={[
                  styles.userEmail,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {user.email}
              </Text>
            </View>
          </View>
        ) : null
      }
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  userName: { fontSize: 16, fontWeight: "600" },
  userEmail: { fontSize: 13, marginTop: 2 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowLabel: { flex: 1, fontSize: 15 },
});
