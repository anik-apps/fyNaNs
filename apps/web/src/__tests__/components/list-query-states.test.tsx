import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BillList } from "@/components/bills/bill-list";
import { BudgetList } from "@/components/budgets/budget-list";
import { TransactionList } from "@/components/transactions/transaction-list";
import { apiFetch } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const mockApiFetch = vi.mocked(apiFetch);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

const bill = {
  id: "b1",
  name: "Netflix",
  amount: "15.99",
  frequency: "monthly",
  next_due_date: "2026-07-20",
  is_auto_pay: false,
  days_until_due: 7,
  category_name: null,
};

function txn(id: string, description: string) {
  return {
    id,
    date: "2026-07-10",
    description,
    merchant_name: null,
    amount: "12.50",
    category_name: "Restaurants",
    category_color: "#4A90D9",
    account_name: "Checking",
    is_pending: false,
  };
}

describe("BillList", () => {
  it("renders an error box with retry on fetch failure, not the empty state", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    render(<BillList />, { wrapper: createWrapper() });

    expect(await screen.findByText("Server error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/no bills yet/i)).not.toBeInTheDocument();
  });

  it("refetches when retry is clicked", async () => {
    mockApiFetch
      .mockRejectedValueOnce(new Error("Server error"))
      .mockResolvedValueOnce([bill]);
    render(<BillList />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Netflix")).toBeInTheDocument();
  });

  it("renders the empty state only on successful empty data", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<BillList />, { wrapper: createWrapper() });

    expect(await screen.findByText(/no bills yet/i)).toBeInTheDocument();
  });
});

describe("BudgetList", () => {
  it("renders an error box with retry on fetch failure, not the empty state", async () => {
    mockApiFetch.mockRejectedValue(new Error("Boom"));
    render(<BudgetList />, { wrapper: createWrapper() });

    expect(await screen.findByText("Boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/no budgets yet/i)).not.toBeInTheDocument();
  });

  it("renders the empty state only on successful empty data", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<BudgetList />, { wrapper: createWrapper() });

    expect(await screen.findByText(/no budgets yet/i)).toBeInTheDocument();
  });
});

describe("TransactionList", () => {
  const baseProps = { search: "", category: "all", accountId: "all" };

  it("keeps previous results visible while a filter change refetches", async () => {
    mockApiFetch.mockResolvedValueOnce({
      items: [txn("t1", "Coffee Shop")],
      next_cursor: null,
    });
    const wrapper = createWrapper();
    const { rerender } = render(<TransactionList {...baseProps} />, {
      wrapper,
    });
    expect(await screen.findByText("Coffee Shop")).toBeInTheDocument();

    // New search: refetch stays pending — previous results must remain visible
    let resolveNext!: (value: unknown) => void;
    mockApiFetch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveNext = resolve))
    );
    rerender(<TransactionList {...baseProps} search="latte" />);

    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();

    resolveNext({ items: [txn("t2", "Latte Place")], next_cursor: null });
    expect(await screen.findByText("Latte Place")).toBeInTheDocument();
    expect(screen.queryByText("Coffee Shop")).not.toBeInTheDocument();
  });

  it("appends the next page on Load more", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        items: [txn("t1", "Coffee Shop")],
        next_cursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [txn("t2", "Grocery Store")],
        next_cursor: null,
      });
    render(<TransactionList {...baseProps} />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /load more/i }));

    expect(await screen.findByText("Grocery Store")).toBeInTheDocument();
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /load more/i })
    ).not.toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenLastCalledWith(
      expect.stringContaining("cursor=cursor-1")
    );
  });

  it("renders an error box on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network down"));
    render(<TransactionList {...baseProps} />, { wrapper: createWrapper() });

    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(
      screen.queryByText(/no transactions found/i)
    ).not.toBeInTheDocument();
  });
});
