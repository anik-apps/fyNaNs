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
  // True while an unlock attempt (biometric prompt) is in flight. On iOS the
  // Face ID sheet itself drives AppState active→inactive→active, which must
  // not re-lock or re-prompt mid-attempt.
  const isAuthenticatingRef = useRef(false);
  const hasLockedOnLaunchRef = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    try {
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
    } finally {
      isAuthenticatingRef.current = false;
    }
  }, [authenticate]);

  // "Use password instead": clear the session so the user lands on the login
  // screen (AuthProvider's route guard redirects once user is null) and can
  // re-authenticate with their password. Only dismiss the lock once logout
  // has actually completed — dismissing on failure would expose the app with
  // the session still active.
  const signOutToLogin = useCallback(async () => {
    try {
      await logout();
      setAuthFailed(false);
      setIsLocked(false);
    } catch {
      setAuthFailed(true);
    }
  }, [logout]);

  // Cold start: the AppState listener below only fires on transitions, so a
  // force-quit + relaunch would otherwise land on the dashboard unlocked.
  // Lock once as soon as the (async-loaded) session and biometric preference
  // are both available.
  useEffect(() => {
    if (hasLockedOnLaunchRef.current || !user || !isEnabled) return;
    hasLockedOnLaunchRef.current = true;
    setIsLocked(true);
    tryUnlock();
  }, [user, isEnabled, tryUnlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const previousState = appState.current;
        appState.current = nextState;
        // Ignore transitions caused by the biometric prompt itself.
        if (isAuthenticatingRef.current) return;
        // Only re-lock when returning from the background. "inactive" also
        // fires for the notification shade and the Face ID sheet, which must
        // not lock the app.
        if (
          previousState === "background" &&
          nextState === "active" &&
          user &&
          isEnabled
        ) {
          setAuthFailed(false);
          setIsLocked(true);
          tryUnlock();
        }
      }
    );
    return () => subscription.remove();
  }, [user, isEnabled, tryUnlock]);

  // Render the lock as an opaque overlay above the app instead of replacing
  // it, so backgrounding doesn't unmount the navigator and lose its state.
  return (
    <View style={styles.appContainer}>
      {children}
      {isLocked && (
        <View
          pointerEvents="auto"
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
      )}
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  // No SafeAreaProvider here: expo-router's ExpoRoot already wraps the app
  // in one, so adding another is redundant.
  return (
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
  );
}

const styles = StyleSheet.create({
  appContainer: { flex: 1 },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
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
