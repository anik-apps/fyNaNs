import React from "react";
import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthValue}>{ui}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe("DashboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading skeleton (no content) initially", () => {
    const { apiFetch } = require("@/src/lib/api-client");
    apiFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { queryByText } = renderWithProviders(<DashboardScreen />);
    // During loading, the screen should not have dashboard content
    expect(queryByText("Net Worth")).toBeNull();
  });

  it("renders net worth once the dashboard query resolves", async () => {
    const { apiFetch } = require("@/src/lib/api-client");
    apiFetch.mockImplementation((path: string) => {
      if (path === "/api/dashboard") {
        return Promise.resolve({
          net_worth: {
            total_assets: "1000.00",
            total_liabilities: "250.00",
            net_worth: "750.00",
          },
        });
      }
      // NetWorthCard fetches its own chart history
      return Promise.resolve({ points: [] });
    });

    const { findByText } = renderWithProviders(<DashboardScreen />);
    expect(await findByText("Net Worth")).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith("/api/dashboard");
  });

  it("renders error view when the dashboard query fails", async () => {
    const { apiFetch } = require("@/src/lib/api-client");
    apiFetch.mockRejectedValue(new Error("Server error"));

    const { findByText } = renderWithProviders(<DashboardScreen />);
    expect(await findByText("Server error")).toBeTruthy();
  });
});
