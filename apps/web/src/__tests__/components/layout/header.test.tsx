import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { name: "Test User", email: "test@example.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { apiFetch } from "@/lib/api-client";
const mockApiFetch = vi.mocked(apiFetch);

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Header />
    </QueryClientProvider>
  );
}

describe("Header notification bell", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("has an accessible label on the bell link and avatar trigger", async () => {
    mockApiFetch.mockResolvedValue({ unread_count: 0 });
    renderHeader();
    expect(
      screen.getByRole("link", { name: "Notifications" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Account menu" })
    ).toBeInTheDocument();
  });

  it("shows no badge when there are no unread notifications", async () => {
    mockApiFetch.mockResolvedValue({ unread_count: 0 });
    renderHeader();
    expect(
      await screen.findByRole("link", { name: "Notifications" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument();
  });

  it("shows the unread count badge when there are unread notifications", async () => {
    mockApiFetch.mockResolvedValue({ unread_count: 3 });
    renderHeader();
    const badge = await screen.findByTestId("unread-badge");
    expect(badge).toHaveTextContent("3");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/notifications?limit=1");
  });

  it("caps the badge at 9+ for two-digit counts", async () => {
    mockApiFetch.mockResolvedValue({ unread_count: 42 });
    renderHeader();
    const badge = await screen.findByTestId("unread-badge");
    expect(badge).toHaveTextContent("9+");
  });

  it("announces the unread count in the bell's accessible label", async () => {
    mockApiFetch.mockResolvedValue({ unread_count: 3 });
    renderHeader();
    expect(
      await screen.findByRole("link", { name: "Notifications (3 unread)" })
    ).toBeInTheDocument();
    // The visual badge is redundant for screen readers.
    expect(screen.getByTestId("unread-badge")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
