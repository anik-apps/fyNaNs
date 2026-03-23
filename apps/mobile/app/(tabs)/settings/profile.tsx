import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { apiFetch } from "@/src/lib/api-client";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useAuth } from "@/src/hooks/useAuth";

export default function ProfileSettingsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiFetch<any>("/api/user/profile")
      .then((data) => {
        setName(data.name || "");
        setEmail(data.email || "");
      })
      .catch(() => Alert.alert("Error", "Failed to load profile"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave() {
    setIsSaving(true);
    try {
      await apiFetch("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      Alert.alert("Success", "Profile updated");
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <Stack.Screen options={{ headerShown: true, title: "Profile" }} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Stack.Screen options={{ headerShown: true, title: "Profile" }} />

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Name
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
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Email
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                color: theme.colors.textSecondary,
                backgroundColor: theme.colors.skeleton,
              },
            ]}
            value={email}
            editable={false}
          />
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            Email cannot be changed
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.colors.primary },
            isSaving && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>

        {user?.is_dev && (
          <TouchableOpacity
            style={[styles.devButton, { borderColor: theme.colors.border }]}
            onPress={() => router.push("/settings/dev")}
          >
            <Text style={[styles.devButtonText, { color: theme.colors.textSecondary }]}>
              Dev Settings
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  form: { gap: 20 },
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginTop: 2 },
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  devButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  devButtonText: { fontSize: 14, fontWeight: "500" },
});
