import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { formatDate } from "@/src/lib/utils";

export default function SecuritySettingsScreen() {
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  useEffect(() => {
    apiFetch<any[]>("/api/auth/sessions")
      .then(setSessions)
      .catch(() => {})
      .finally(() => setIsLoadingSessions(false));
  }, []);

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiFetch("/api/auth/password/change", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      Alert.alert("Success", "Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    try {
      await apiFetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      Alert.alert("Error", "Failed to revoke session");
    }
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Stack.Screen options={{ headerShown: true, title: "Security" }} />

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Change Password
            </Text>
            <View style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: theme.colors.primary },
                  isChangingPassword && styles.buttonDisabled,
                ]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                <Text style={styles.buttonText}>
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.text, marginTop: 32 },
              ]}
            >
              Active Sessions
            </Text>
            {isLoadingSessions && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={{ marginTop: 12 }}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.sessionRow,
              { borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.sessionInfo}>
              <Text style={[styles.sessionDevice, { color: theme.colors.text }]}>
                {item.device_info || "Unknown device"}
              </Text>
              <Text
                style={[
                  styles.sessionDate,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Created {formatDate(item.created_at)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleRevokeSession(item.id)}
            >
              <Text style={[styles.revokeText, { color: theme.colors.error }]}>
                Revoke
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !isLoadingSessions ? (
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.textSecondary },
              ]}
            >
              No active sessions
            </Text>
          ) : null
        }
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sessionInfo: { flex: 1 },
  sessionDevice: { fontSize: 14, fontWeight: "500" },
  sessionDate: { fontSize: 12, marginTop: 2 },
  revokeText: { fontSize: 14, fontWeight: "500" },
  emptyText: { textAlign: "center", marginTop: 12, fontSize: 14 },
});
