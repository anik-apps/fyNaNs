import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  Platform,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Lock } from "lucide-react-native";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { AuthProvider } from "@/src/providers/AuthProvider";
import { ThemeProvider, useTheme } from "@/src/providers/ThemeProvider";
import { useBiometric } from "@/src/hooks/useBiometric";
import { useAuth } from "@/src/hooks/useAuth";
import { queryClient } from "@/src/lib/query-client";
// Push notifications removed from Expo Go SDK 53+
// import { usePushNotifications } from "@/src/hooks/usePushNotifications";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// Wire TanStack Query's focusManager to React Native's AppState so queries
// refetch (when stale) as the app returns to the foreground.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

try {
  GoogleSignin.configure({
    webClientId: "110399383495-tvvn8ncuaju99704n3bsielli80bv89d.apps.googleusercontent.com",
  });
} catch (e) {
  if (__DEV__) console.warn("GoogleSignin.configure failed:", e);
}

// Exported for tests.
export function AppContent({ children }: { children: React.ReactNode }) {
  const appState = useRef(AppState.currentState);
  const { isEnabled, authenticate } = useBiometric();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [isLocked, setIsLocked] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  const tryUnlock = useCallback(async () => {
    let success = false;
    try {
      success = await authenticate();
    } catch {
      success = false;
    }
    if (success) {
      setIsLocked(false);
      setAuthFailed(false);
    } else {
      // Stay locked and surface the failure so the user can retry or fall
      // back to password sign-in instead of being stranded on the overlay.
      setAuthFailed(true);
    }
  }, [authenticate]);

  // "Use password instead": clear the session so the user lands on the login
  // screen (AuthProvider's route guard redirects once user is null) and can
  // re-authenticate with their password.
  const signOutToLogin = useCallback(async () => {
    try {
      await logout();
    } finally {
      setAuthFailed(false);
      setIsLocked(false);
    }
  }, [logout]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appState.current?.match(/inactive|background/) &&
          nextState === "active" &&
          user &&
          isEnabled
        ) {
          setAuthFailed(false);
          setIsLocked(true);
          tryUnlock();
        }
        appState.current = nextState;
      }
    );
    return () => subscription.remove();
  }, [user, isEnabled, tryUnlock]);

  if (isLocked) {
    return (
      <View
        style={[
          styles.lockOverlay,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Lock color={theme.colors.primary} size={48} />
        <Text style={[styles.lockTitle, { color: theme.colors.text }]}>
          fyNaNs is locked
        </Text>
        {authFailed && (
          <Text
            style={[styles.lockError, { color: theme.colors.textSecondary }]}
          >
            Authentication failed — try again
          </Text>
        )}
        <TouchableOpacity
          testID="unlock-button"
          style={[
            styles.unlockButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={tryUnlock}
        >
          <Text
            style={[styles.unlockButtonText, { color: theme.colors.primaryText }]}
          >
            Unlock
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="use-password-link"
          onPress={signOutToLogin}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.passwordLink, { color: theme.colors.primary }]}>
            Use password instead
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <StatusBar style="auto" />
            <AppContent>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </AppContent>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  lockOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  lockError: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  unlockButton: {
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 24,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  passwordLink: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 16,
  },
});
