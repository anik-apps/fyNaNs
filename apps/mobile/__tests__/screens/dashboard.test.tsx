import React from "react";
import { render } from "@testing-library/react-native";
import DashboardScreen from "@/app/(tabs)/index";
import { AuthContext } from "@/src/providers/AuthProvider";

// Mock the API client
jest.mock("@/src/lib/api-client", () => ({
  apiFetch: jest.fn(),
  setAccessToken: jest.fn(),
  getAccessToken: jest.fn(),
}));

const mockAuthValue = {
  user: { id: "1", email: "test@test.com", name: "Test", avatar_url: null, has_mfa: false, is_dev: false },
  isLoading: false,
  accessToken: "mock-token",
  login: jest.fn(),
  register: jest.fn(),
  verifyMfa: jest.fn(),
  logout: jest.fn(),
  refreshAuth: jest.fn(),
  loginWithOAuth: jest.fn(),
};

function renderWithAuth(ui: React.ReactElement) {
  return render(
    <AuthContext.Provider value={mockAuthValue}>{ui}</AuthContext.Provider>
  );
}

describe("DashboardScreen", () => {
  it("renders loading indicator initially", () => {
    const { apiFetch } = require("@/src/lib/api-client");
    apiFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { getByTestId, queryByText } = renderWithAuth(<DashboardScreen />);
    // During loading, the screen should not have dashboard content
    expect(queryByText("Net Worth")).toBeNull();
  });
});
