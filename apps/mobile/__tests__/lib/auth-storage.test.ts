import * as SecureStore from "expo-secure-store";
import {
  getRefreshToken,
  setRefreshToken,
  deleteRefreshToken,
} from "@/src/lib/auth-storage";

describe("auth-storage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stores refresh token via SecureStore", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    await setRefreshToken("test-token");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "fynans_refresh_token",
      "test-token",
      expect.objectContaining({
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
    );
  });

  it("retrieves refresh token from SecureStore", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("test-token");

    const token = await getRefreshToken();
    expect(token).toBe("test-token");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      "fynans_refresh_token"
    );
  });

  it("returns null when no token stored", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const token = await getRefreshToken();
    expect(token).toBeNull();
  });

  it("returns null when SecureStore throws", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
      new Error("Access denied")
    );

    const token = await getRefreshToken();
    expect(token).toBeNull();
  });

  it("deletes refresh token", async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    await deleteRefreshToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "fynans_refresh_token"
    );
  });
});
