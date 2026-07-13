import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "@/app/(app)/settings/page";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
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

describe("SettingsPage export", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("shows a success banner after the export request succeeds", async () => {
    mockApiFetch.mockResolvedValue({});
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /export data/i }));

    expect(
      await screen.findByText(/export started — we'll email you the file\./i)
    ).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/user/export", {
      method: "POST",
    });
  });

  it("shows a destructive banner when the export fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Export service unavailable"));
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /export data/i }));

    expect(
      await screen.findByText("Export service unavailable")
    ).toBeInTheDocument();
  });
});
