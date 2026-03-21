import React from "react";
import { render } from "@testing-library/react-native";
import LoginScreen from "@/app/(auth)/login";
import { AuthContext } from "@/src/providers/AuthProvider";

const mockAuthValue = {
  user: null,
  isLoading: false,
  accessToken: null,
  login: jest.fn(),
  register: jest.fn(),
  verifyMfa: jest.fn(),
  logout: jest.fn(),
  refreshAuth: jest.fn(),
};

function renderWithAuth(ui: React.ReactElement) {
  return render(
    <AuthContext.Provider value={mockAuthValue}>{ui}</AuthContext.Provider>
  );
}

describe("LoginScreen", () => {
  it("renders email and password inputs", () => {
    const { getByTestId } = renderWithAuth(<LoginScreen />);
    expect(getByTestId("email-input")).toBeTruthy();
    expect(getByTestId("password-input")).toBeTruthy();
  });

  it("renders sign in button", () => {
    const { getByTestId } = renderWithAuth(<LoginScreen />);
    expect(getByTestId("login-button")).toBeTruthy();
  });

  it("renders sign up link text", () => {
    const { getByText } = renderWithAuth(<LoginScreen />);
    expect(getByText("Don't have an account?")).toBeTruthy();
  });
});
