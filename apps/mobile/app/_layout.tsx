import { useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  Platform,
  View,
  StyleSheet,
} from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { AuthProvider } from "@/src/providers/AuthProvider";
import { ThemeProvider } from "@/src/providers/ThemeProvider";
import { useBiometric } from "@/src/hooks/useBiometric";
import { useAuth } from "@/src/hooks/useAuth";
import { ApiError } from "@/src/lib/api-client";
// Push notifications removed from Expo Go SDK 53+
// import { usePushNotifications } from "@/src/hooks/usePushNotifications";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Client errors (4xx) won't succeed on retry; don't hammer the API.
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

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

function AppContent({ children }: { children: React.ReactNode }) {
  const appState = useRef(AppState.currentState);
  const { isEnabled, authenticate } = useBiometric();
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === "active" &&
          user &&
          isEnabled
        ) {
          setIsLocked(true);
          authenticate().then((success) => {
            if (success) setIsLocked(false);
          });
        }
        appState.current = nextState;
      }
    );
    return () => subscription.remove();
  }, [user, isEnabled, authenticate]);

  if (isLocked) {
    return (
      <View style={styles.lockOverlay}>
        <View style={styles.lockContent} />
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
  lockOverlay: {
    flex: 1,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  lockContent: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4A90D9",
  },
});
