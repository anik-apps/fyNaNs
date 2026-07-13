import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BillCard } from "@/components/bills/bill-card";
import { BudgetProgress } from "@/components/budgets/budget-progress";
import { apiFetch } from "@/lib/api-client";
import type { Bill } from "@/components/bills/types";
import type { Budget } from "@/components/budgets/types";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  return { ...result, queryClient, invalidateSpy };
}

const bill: Bill = {
  id: "b1",
  name: "Netflix",
  amount: "15.99",
  frequency: "monthly",
  day_of_month: 15,
  next_due_date: "2026-07-20",
  reminder_days: 3,
  is_auto_pay: false,
  days_until_due: 7,
  category_name: null,
};

const budget: Budget = {
  id: "bud1",
  category_id: "cat1",
  category_name: "Groceries",
  category_color: "#4A90D9",
  category_icon: "cart",
  amount_limit: "500.00",
  amount_spent: "120.00",
  percent_spent: 24,
  period: "monthly",
};

beforeEach(() => {
  mockApiFetch.mockReset();
});

async function openMenuAndSelect(triggerName: RegExp, itemName: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: triggerName }));
  await user.click(await screen.findByRole("menuitem", { name: itemName }));
  return user;
}

describe("BillCard actions", () => {
  it("opens the edit dialog pre-filled with the bill's values", async () => {
    renderWithClient(<BillCard bill={bill} />);

    await openMenuAndSelect(/actions for netflix/i, /edit/i);

    expect(await screen.findByText("Edit bill")).toBeInTheDocument();
    expect(screen.getByLabelText("Bill Name")).toHaveValue("Netflix");
    expect(screen.getByLabelText("Amount")).toHaveValue(15.99);
    expect(screen.getByLabelText("Day of Month")).toHaveValue(15);
    expect(screen.getByLabelText("Reminder (days before)")).toHaveValue(3);
  });

  it("saves an edit with PUT and invalidates bills and dashboard", async () => {
    mockApiFetch.mockResolvedValue(bill);
    const { invalidateSpy } = renderWithClient(<BillCard bill={bill} />);

    const user = await openMenuAndSelect(/actions for netflix/i, /edit/i);

    const nameInput = await screen.findByLabelText("Bill Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Netflix Premium");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/bills/b1",
        expect.objectContaining({ method: "PUT" })
      )
    );
    const [, options] = mockApiFetch.mock.calls[0];
    expect(JSON.parse((options as RequestInit).body as string)).toMatchObject({
      name: "Netflix Premium",
      amount: "15.99",
      day_of_month: 15,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bills"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    await waitFor(() =>
      expect(screen.queryByText("Edit bill")).not.toBeInTheDocument()
    );
  });

  it("confirms deletion, fires DELETE and invalidates bills and dashboard", async () => {
    mockApiFetch.mockResolvedValue({ detail: "Bill deleted" });
    const { invalidateSpy } = renderWithClient(<BillCard bill={bill} />);

    const user = await openMenuAndSelect(/actions for netflix/i, /delete/i);

    expect(
      await screen.findByText('Delete "Netflix"?')
    ).toBeInTheDocument();
    expect(
      screen.getByText("This removes the bill permanently.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/bills/b1", {
        method: "DELETE",
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bills"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    await waitFor(() =>
      expect(screen.queryByText('Delete "Netflix"?')).not.toBeInTheDocument()
    );
  });

  it("keeps the delete dialog open with an error message when DELETE fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    const { invalidateSpy } = renderWithClient(<BillCard bill={bill} />);

    const user = await openMenuAndSelect(/actions for netflix/i, /delete/i);
    await user.click(
      await screen.findByRole("button", { name: /^delete$/i })
    );

    expect(await screen.findByText("Server error")).toBeInTheDocument();
    expect(screen.getByText('Delete "Netflix"?')).toBeInTheDocument();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("BudgetProgress actions", () => {
  it("opens the edit dialog pre-filled with the category locked", async () => {
    renderWithClient(<BudgetProgress budget={budget} />);

    await openMenuAndSelect(/actions for groceries budget/i, /edit/i);

    expect(await screen.findByText("Edit budget")).toBeInTheDocument();
    const categoryInput = screen.getByLabelText("Category");
    expect(categoryInput).toHaveValue("Groceries");
    expect(categoryInput).toBeDisabled();
    expect(screen.getByLabelText("Budget Amount")).toHaveValue(500);
    // The category list is not fetched in edit mode.
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/categories");
  });

  it("saves an edit with PUT sending only amount_limit and period", async () => {
    mockApiFetch.mockResolvedValue(budget);
    const { invalidateSpy } = renderWithClient(
      <BudgetProgress budget={budget} />
    );

    const user = await openMenuAndSelect(
      /actions for groceries budget/i,
      /edit/i
    );

    const amountInput = await screen.findByLabelText("Budget Amount");
    await user.clear(amountInput);
    await user.type(amountInput, "650");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/budgets/bud1",
        expect.objectContaining({ method: "PUT" })
      )
    );
    const [, options] = mockApiFetch.mock.calls[0];
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      amount_limit: "650",
      period: "monthly",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("confirms deletion, fires DELETE and invalidates budgets and dashboard", async () => {
    mockApiFetch.mockResolvedValue({ detail: "Budget deleted" });
    const { invalidateSpy } = renderWithClient(
      <BudgetProgress budget={budget} />
    );

    const user = await openMenuAndSelect(
      /actions for groceries budget/i,
      /delete/i
    );

    expect(
      await screen.findByText('Delete budget for "Groceries"?')
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/budgets/bud1", {
        method: "DELETE",
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    await waitFor(() =>
      expect(
        screen.queryByText('Delete budget for "Groceries"?')
      ).not.toBeInTheDocument()
    );
  });

  it("keeps the delete dialog open with an error message when DELETE fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Boom"));
    renderWithClient(<BudgetProgress budget={budget} />);

    const user = await openMenuAndSelect(
      /actions for groceries budget/i,
      /delete/i
    );
    await user.click(
      await screen.findByRole("button", { name: /^delete$/i })
    );

    expect(await screen.findByText("Boom")).toBeInTheDocument();
    expect(
      screen.getByText('Delete budget for "Groceries"?')
    ).toBeInTheDocument();
  });
});
