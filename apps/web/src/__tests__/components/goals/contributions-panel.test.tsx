import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContributionsPanel } from "@/components/goals/contributions-panel";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api-client";
const mockApiFetch = vi.mocked(apiFetch);

const contributions = [
  {
    id: "c1",
    contribution_date: "2026-07-01",
    amount: "1234.56",
    note: null,
    created_at: "2026-07-01T00:00:00Z",
  },
];

describe("ContributionsPanel", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("formats amounts with thousands grouping via formatCurrency", () => {
    render(
      <ContributionsPanel
        goalId="g1"
        contributions={contributions}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  });

  it("does not delete until the confirmation dialog is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <ContributionsPanel
        goalId="g1"
        contributions={contributions}
        onChanged={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(
      await screen.findByText("Delete contribution?")
    ).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("deletes and calls onChanged after confirming", async () => {
    mockApiFetch.mockResolvedValue({});
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <ContributionsPanel
        goalId="g1"
        contributions={contributions}
        onChanged={onChanged}
      />
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));
    await screen.findByText("Delete contribution?");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/goals/g1/contributions/c1",
        { method: "DELETE" }
      );
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("shows an inline error when the delete fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server exploded"));
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <ContributionsPanel
        goalId="g1"
        contributions={contributions}
        onChanged={onChanged}
      />
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));
    await screen.findByText("Delete contribution?");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
