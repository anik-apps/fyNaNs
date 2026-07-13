import React from "react";
import { Text, AppState, type AppStateStatus } from "react-native";
import { render, fireEvent, act } from "@testing-library/react-native";
import { AppContent } from "@/app/_layout";
import { AuthContext } from "@/src/providers/AuthProvider";
import { ThemeProvider } from "@/src/providers/ThemeProvider";

const mockAuthenticate = jest.fn();
let mockIsEnabled = true;

jest.mock("@/src/hooks/useBiometric", () => ({
  useBiometric: () => ({
    isAvailable: true,
    isEnabled: mockIsEnabled,
    biometricType: "Face ID",
    authenticate: mockAuthenticate,
    enable: jest.fn(),
    disable: jest.fn(),
  }),
}));

const mockLogout = jest.fn();

const mockAuthValue = {
  user: {
    id: "1",
    email: "test@test.com",
    name: "Test",
    avatar_url: null,
    has_mfa: false,
    is_dev: false,
  },
  isLoading: false,
  accessToken: "mock-token",
  login: jest.fn(),
  register: jest.fn(),
  verifyMfa: jest.fn(),
  logout: mockLogout,
  refreshAuth: jest.fn(),
  loginWithOAuth: jest.fn(),
};

let appStateHandler: (state: AppStateStatus) => void;

function renderAppContent() {
  return render(
    <ThemeProvider>
      <AuthContext.Provider value={mockAuthValue}>
        <AppContent>
          <Text>APP CONTENT</Text>
        </AppContent>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

// Flush the cold-start lock effect and any pending unlock promise.
async function flush() {
  await act(async () => {});
}

async function transition(...states: AppStateStatus[]) {
  await act(async () => {
    for (const state of states) appStateHandler(state);
  });
}

describe("AppContent biometric lock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEnabled = true;
    mockLogout.mockResolvedValue(undefined);
    // react-native's jest mock sets currentState to a jest.fn(); the
    // component expects an AppStateStatus string.
    (AppState as { currentState: AppStateStatus }).currentState = "active";
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation(((_type: string, handler: (state: AppStateStatus) => void) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      }) as unknown as typeof AppState.addEventListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not lock on cold start when biometric is disabled", async () => {
    mockIsEnabled = false;
    const { getByText, queryByText } = renderAppContent();
    await flush();

    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(queryByText("fyNaNs is locked")).toBeNull();
    expect(getByText("APP CONTENT")).toBeTruthy();
  });

  it("locks on cold start and unlocks when the biometric prompt succeeds", async () => {
    let resolveAuth: (success: boolean) => void;
    mockAuthenticate.mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveAuth = resolve))
    );
    const { getByText, queryByText } = renderAppContent();
    await flush();

    // Locked immediately on launch (no AppState transition needed); the app
    // stays mounted underneath the overlay.
    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("APP CONTENT")).toBeTruthy();
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);

    await act(async () => resolveAuth!(true));
    expect(queryByText("fyNaNs is locked")).toBeNull();
    expect(getByText("APP CONTENT")).toBeTruthy();
  });

  it("re-locks and re-prompts when returning from the background", async () => {
    mockAuthenticate.mockResolvedValueOnce(true); // cold-start unlock
    const { getByText, queryByText } = renderAppContent();
    await flush();
    expect(queryByText("fyNaNs is locked")).toBeNull();

    mockAuthenticate.mockResolvedValueOnce(false);
    await transition("background", "active");

    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("Authentication failed — try again")).toBeTruthy();
    // Children stay mounted (covered by the overlay) so navigation state
    // survives the lock.
    expect(getByText("APP CONTENT")).toBeTruthy();
  });

  it("does not re-lock on inactive→active (notification shade, Face ID sheet)", async () => {
    mockAuthenticate.mockResolvedValueOnce(true); // cold-start unlock
    const { queryByText } = renderAppContent();
    await flush();

    await transition("inactive", "active");

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(queryByText("fyNaNs is locked")).toBeNull();
  });

  it("ignores AppState churn while an unlock attempt is in flight", async () => {
    let resolveAuth: (success: boolean) => void;
    mockAuthenticate.mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveAuth = resolve))
    );
    const { queryByText } = renderAppContent();
    await flush(); // cold-start lock; prompt in flight

    // The biometric sheet drives the app through background/active while
    // authenticate() is pending; this must not trigger a second prompt.
    await transition("inactive", "active", "background", "active");
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);

    await act(async () => resolveAuth!(true));
    expect(queryByText("fyNaNs is locked")).toBeNull();
  });

  it("stays locked with recovery UI when authentication fails", async () => {
    mockAuthenticate.mockResolvedValue(false);
    const { getByText, getByTestId } = renderAppContent();

    await flush();

    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("Authentication failed — try again")).toBeTruthy();
    expect(getByTestId("unlock-button")).toBeTruthy();
    expect(getByText("Use password instead")).toBeTruthy();
  });

  it("stays locked with recovery UI when authentication throws", async () => {
    mockAuthenticate.mockRejectedValue(new Error("biometric error"));
    const { getByText } = renderAppContent();

    await flush();

    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("Authentication failed — try again")).toBeTruthy();
  });

  it("retries authentication from the Unlock button and unlocks on success", async () => {
    mockAuthenticate.mockResolvedValueOnce(false);
    const { getByText, getByTestId, queryByText } = renderAppContent();

    await flush();
    expect(getByText("fyNaNs is locked")).toBeTruthy();

    mockAuthenticate.mockResolvedValueOnce(true);
    await act(async () => {
      fireEvent.press(getByTestId("unlock-button"));
    });

    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    expect(queryByText("fyNaNs is locked")).toBeNull();
    expect(getByText("APP CONTENT")).toBeTruthy();
  });

  it("keeps showing the lock screen when a retry fails again", async () => {
    mockAuthenticate.mockResolvedValue(false);
    const { getByText, getByTestId } = renderAppContent();

    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("unlock-button"));
    });

    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("Authentication failed — try again")).toBeTruthy();
  });

  it("signs out via 'Use password instead' and dismisses the lock screen", async () => {
    mockAuthenticate.mockResolvedValue(false);
    const { getByTestId, queryByText } = renderAppContent();

    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("use-password-link"));
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(queryByText("fyNaNs is locked")).toBeNull();
  });

  it("keeps the lock up when logout rejects instead of exposing the app", async () => {
    mockAuthenticate.mockResolvedValue(false);
    mockLogout.mockRejectedValueOnce(new Error("network down"));
    const { getByText, getByTestId } = renderAppContent();

    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("use-password-link"));
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("Authentication failed — try again")).toBeTruthy();
  });
});
