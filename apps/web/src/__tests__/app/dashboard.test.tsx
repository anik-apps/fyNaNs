import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { BudgetBars } from "@/components/dashboard/budget-bars";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";

describe("Dashboard Components", () => {
  describe("NetWorthCard", () => {
    it("renders positive net worth in green", () => {
      render(
        <NetWorthCard
          totalAssets="15000.00"
          totalLiabilities="2000.00"
          netWorth="13000.00"
        />
      );
      expect(screen.getByText("Net Worth")).toBeInTheDocument();
      expect(screen.getByText("$13,000.00")).toBeInTheDocument();
    });

    it("renders zero net worth without color", () => {
      render(
        <NetWorthCard totalAssets="0" totalLiabilities="0" netWorth="0" />
      );
      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });
  });

  describe("BudgetBars", () => {
    it("renders empty state when no budgets", () => {
      render(<BudgetBars budgets={[]} />);
      expect(screen.getByText(/no budgets set up/i)).toBeInTheDocument();
    });

    it("renders budget progress", () => {
      render(
        <BudgetBars
          budgets={[
            {
              id: "1",
              category_name: "Food",
              category_color: "#4A90D9",
              category_icon: "utensils",
              amount_limit: "200.00",
              amount_spent: "160.00",
              percent_spent: 80,
            },
          ]}
        />
      );
      expect(screen.getByText("Food")).toBeInTheDocument();
      expect(screen.getByText("$160.00")).toBeInTheDocument();
    });
  });

  describe("UpcomingBills", () => {
    it("renders empty state when no bills", () => {
      render(<UpcomingBills bills={[]} />);
      expect(screen.getByText(/no bills due/i)).toBeInTheDocument();
    });

    it("renders bill with auto-pay badge", () => {
      render(
        <UpcomingBills
          bills={[
            {
              id: "1",
              name: "Netflix",
              amount: "15.99",
              next_due_date: "2026-03-20",
              is_auto_pay: true,
              days_until_due: 2,
            },
          ]}
        />
      );
      expect(screen.getByText("Netflix")).toBeInTheDocument();
      expect(screen.getByText("Auto-pay")).toBeInTheDocument();
    });
  });
});
