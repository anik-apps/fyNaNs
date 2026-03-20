"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { BudgetBars } from "@/components/dashboard/budget-bars";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { apiFetch } from "@/lib/api-client";

interface DashboardData {
  net_worth: {
    total_assets: string;
    total_liabilities: string;
    net_worth: string;
  };
  spending_comparison: {
    current_month_total: string;
    previous_month_total: string;
    difference: string;
    percent_change: number | null;
  };
  accounts_by_type: Record<
    string,
    Array<{
      id: string;
      name: string;
      institution_name: string;
      type: string;
      balance: string;
    }>
  >;
  top_budgets: Array<{
    id: string;
    category_name: string;
    category_color: string;
    category_icon: string;
    amount_limit: string;
    amount_spent: string;
    percent_spent: number;
  }>;
  upcoming_bills: Array<{
    id: string;
    name: string;
    amount: string;
    next_due_date: string;
    is_auto_pay: boolean;
    days_until_due: number;
  }>;
  recent_transactions: Array<{
    id: string;
    date: string;
    description: string;
    merchant_name: string | null;
    amount: string;
    category_name: string;
    category_color: string;
    account_name: string;
    account_type: string;
    is_pending: boolean;
  }>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const result = await apiFetch<DashboardData>("/api/dashboard");
        setData(result);
      } catch {
        // Auth redirect handled by apiFetch
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NetWorthCard
          totalAssets={data.net_worth.total_assets}
          totalLiabilities={data.net_worth.total_liabilities}
          netWorth={data.net_worth.net_worth}
        />
        <SpendingChart
          currentMonth={data.spending_comparison.current_month_total}
          previousMonth={data.spending_comparison.previous_month_total}
          difference={data.spending_comparison.difference}
          percentChange={data.spending_comparison.percent_change}
        />
      </div>

      <AccountsSummary accountsByType={data.accounts_by_type} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BudgetBars budgets={data.top_budgets} />
        <UpcomingBills bills={data.upcoming_bills} />
      </div>

      <RecentTransactions transactions={data.recent_transactions} />
    </div>
  );
}
