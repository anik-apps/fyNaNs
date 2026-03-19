import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/login-form";
import { AuthContext } from "@/providers/auth-provider";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/login",
}));

function renderWithAuth(ui: React.ReactElement) {
  const mockAuth = {
    user: null,
    isLoading: false,
    login: vi.fn().mockResolvedValue({}),
    register: vi.fn(),
    loginWithOAuth: vi.fn(),
    verifyMfaCode: vi.fn(),
    logout: vi.fn(),
  };
  return {
    ...render(
      <AuthContext.Provider value={mockAuth}>{ui}</AuthContext.Provider>
    ),
    mockAuth,
  };
}

describe("LoginForm", () => {
  it("renders email and password fields", () => {
    renderWithAuth(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows validation error for empty email", async () => {
    renderWithAuth(<LoginForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it("calls login on valid submit", async () => {
    const { mockAuth } = renderWithAuth(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(mockAuth.login).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("displays error message on login failure", async () => {
    const { mockAuth } = renderWithAuth(<LoginForm />);
    mockAuth.login.mockRejectedValue(new Error("Invalid credentials"));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText(/invalid credentials/i)
    ).toBeInTheDocument();
  });
});
