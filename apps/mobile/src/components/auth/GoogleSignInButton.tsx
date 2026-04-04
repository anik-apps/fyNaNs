import React, { useState } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  View,
} from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useAuth } from "@/src/hooks/useAuth";

export function GoogleSignInButton() {
  const { loginWithOAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  async function handleGoogleSignIn() {
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        Alert.alert("Error", "Google sign-in configuration error. Please try again.");
        return;
      }

      await loginWithOAuth("google", idToken);
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          return;
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert("Error", "Google Play Services is not available on this device.");
          return;
        }
      }
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Google sign-in failed"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleGoogleSignIn}
      disabled={isLoading}
      testID="google-signin-button"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#333" />
      ) : (
        <View style={styles.content}>
          <Text style={styles.googleLogo}>G</Text>
          <Text style={styles.text}>Continue with Google</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  googleLogo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4285F4",
  },
  text: {
    fontSize: 16,
    fontWeight: "500",
    color: "#555",
  },
});
