import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const REFRESH_TOKEN_KEY = "fynans_refresh_token";
const DEVICE_INFO_KEY = "fynans_device_info";

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function deleteRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getDeviceInfo(): Promise<string> {
  let info = await SecureStore.getItemAsync(DEVICE_INFO_KEY);
  if (!info) {
    info = `${Platform.OS}-${Date.now()}`;
    await SecureStore.setItemAsync(DEVICE_INFO_KEY, info);
  }
  return info;
}
