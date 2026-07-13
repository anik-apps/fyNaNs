import React from "react";
import { Text, AppState, type AppStateStatus } from "react-native";
import { render, fireEvent, act } from "@testing-library/react-native";
import { AppContent } from "@/app/_layout";
import { AuthContext } from "@/src/providers/AuthProvider";
import { ThemeProvider } from "@/src/providers/ThemeProvider";

const mockAuthenticate = jest.fn();

jest.mock("@/src/hooks/useBiometric", () => ({
  useBiometric: () => ({
    isAvailable: true,
    isEnabled: true,
    biometricType: "Face ID",
    authenticate: mockAuthenticate,
    enable: jest.fn(),
    disable: jest.fn(),
  }),
}));

const mockLogout = jest.fn().mockResolvedValue(undefined);

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

// Simulate the app being backgrounded then foregrounded, which triggers the
// biometric lock in AppContent.
async function goBackgroundThenForeground() {
  await act(async () => {
    appStateHandler("background");
    appStateHandler("active");
  });
}

describe("AppContent biometric lock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("renders children while unlocked", () => {
    const { getByText, queryByText } = renderAppContent();
    expect(getByText("APP CONTENT")).toBeTruthy();
    expect(queryByText("fyNaNs is locked")).toBeNull();
  });

  it("unlocks when the foreground biometric prompt succeeds", async () => {
    mockAuthenticate.mockResolvedValue(true);
    const { getByText, queryByText } = renderAppContent();

    await goBackgroundThenForeground();

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(queryByText("fyNaNs is locked")).toBeNull();
    expect(getByText("APP CONTENT")).toBeTruthy();
  });

  it("stays locked with recovery UI when authentication fails", async () => {
    mockAuthenticate.mockResolvedValue(false);
    const { getByText, getByTestId, queryByText } = renderAppContent();

    await goBackgroundThenForeground();

    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("Authentication failed — try again")).toBeTruthy();
    expect(getByTestId("unlock-button")).toBeTruthy();
    expect(getByText("Use password instead")).toBeTruthy();
    expect(queryByText("APP CONTENT")).toBeNull();
  });

  it("stays locked with recovery UI when authentication throws", async () => {
    mockAuthenticate.mockRejectedValue(new Error("biometric error"));
    const { getByText, queryByText } = renderAppContent();

    await goBackgroundThenForeground();

    expect(getByText("fyNaNs is locked")).toBeTruthy();
    expect(getByText("Authentication failed — try again")).toBeTruthy();
    expect(queryByText("APP CONTENT")).toBeNull();
  });

  it("retries authentication from the Unlock button and unlocks on success", async () => {
    mockAuthenticate.mockResolvedValueOnce(false);
    const { getByText, getByTestId, queryByText } = renderAppContent();

    await goBackgroundThenForeground();
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

    await goBackgroundThenForeground();

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

    await goBackgroundThenForeground();

    await act(async () => {
      fireEvent.press(getByTestId("use-password-link"));
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(queryByText("fyNaNs is locked")).toBeNull();
  });
});
