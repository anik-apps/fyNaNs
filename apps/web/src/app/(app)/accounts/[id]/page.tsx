"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { ChartModal } from "@/components/dashboard/chart-modal";
import {
  Building2, Calendar, Expand, Search, Trash2,
} from "lucide-react";
import { ACCOUNT_TYPE_CONFIG } from "@/lib/account-type-config";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";
import { useDebounce } from "@/hooks/use-debounce";

interface AccountDetail {
  id: string;
  name: string;
  type: string;
  balance: string;
  institution_name: string;
  is_manual: boolean;
  plaid_item_id: string | null;
  last_synced: string | null;
  currency: string;
}

interface Transaction {
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
}

const TIME_RANGES = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "6m", label: "6m" },
  { value: "1y", label: "1y" },
  { value: "all", label: "All" },
];

function getDateFrom(range: string): string | undefined {
  if (range === "all") return undefined;
  const days: Record<string, number> = { "30d": 30, "90d": 90, "6m": 180, "1y": 365 };
  const d = new Date(Date.now() - (days[range] || 30) * 86400000);
  return d.toISOString().split("T")[0];
}

function CategoryPieChart({
  data,
  size = 112,
  innerRadius = 25,
  outerRadius = 50,
}: {
  data: Array<{ name: string; color: string; total: number }>;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  return (
    <ResponsiveContainer width={size} height={size}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            fontSize: "12px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--popover)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [chartModalOpen, setChartModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const debouncedSearch = useDebounce(search, 300);

  const dateFrom = useMemo(() => getDateFrom(timeRange), [timeRange]);

  const fetchTransactions = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("account_id", accountId);
    params.set("limit", "50");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (dateFrom) params.set("date_from", dateFrom);

    try {
      const data = await apiFetch<{ items: Transaction[] }>(
        `/api/transactions?${params.toString()}`
      );
      setTransactions(data.items);
    } catch {
      // handled by API client
    }
  }, [accountId, debouncedSearch, dateFrom]);

  useEffect(() => {
    async function fetchData() {
      try {
        const acct = await apiFetch<AccountDetail>(`/api/accounts/${accountId}`);
        setAccount(acct);
      } catch {
        // handled
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [accountId]);

  useEffect(() => {
    if (!isLoading) fetchTransactions();
  }, [isLoading, fetchTransactions]);

  // Compute category breakdown for pie chart
  const categoryBreakdown = useMemo(() => {
    const skip = new Set(["Income", "Salary", "Freelance", "Other Income", "Investments", "Transfer"]);
    const map: Record<string, { name: string; color: string; total: number }> = {};
    for (const txn of transactions) {
      const cat = txn.category_name || "Uncategorized";
      if (skip.has(cat)) continue;
      const amt = Math.abs(parseFloat(txn.amount));
      if (!map[cat]) map[cat] = { name: cat, color: txn.category_color || "#6b7280", total: 0 };
      map[cat].total += amt;
    }
    return Object.values(map).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const handleDeleteAccount = useCallback(async () => {
    if (!account) return;
    if (!confirm(`Delete "${account.name}" and all its transactions?`)) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      router.push("/accounts");
    } catch {
      setIsDeleting(false);
    }
  }, [account, accountId, router]);

  const handleUnlinkBank = useCallback(async (deleteAccounts: boolean) => {
    if (!account?.plaid_item_id) return;
    const msg = deleteAccounts
      ? `Unlink and DELETE all accounts + transactions from ${account.institution_name}?`
      : `Unlink ${account.institution_name}? Accounts kept as manual.`;
    if (!confirm(msg)) return;
    setIsDeleting(true);
    try {
      const params = deleteAccounts ? "?delete_accounts=true" : "";
      await apiFetch(`/api/plaid/items/${account.plaid_item_id}${params}`, { method: "DELETE" });
      router.push("/accounts");
    } catch {
      setIsDeleting(false);
    }
  }, [account, router]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!account) {
    return <div className="text-center py-12 text-muted-foreground">Account not found</div>;
  }

  const config = ACCOUNT_TYPE_CONFIG[account.type] || { label: account.type, icon: Building2, color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30" };
  const Icon = config.icon;
  const isLiability = account.type === "credit" || account.type === "loan";

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <div className="flex gap-2">
            {!account.is_manual && account.plaid_item_id && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleUnlinkBank(false)} disabled={isDeleting}>
                  Unlink (Keep Data)
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleUnlinkBank(true)} disabled={isDeleting} className="text-destructive hover:text-destructive">
                  Unlink & Delete
                </Button>
              </>
            )}
            <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={isDeleting}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        {/* Account Info + Pie Chart */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {/* Left: Account info */}
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", config.color)}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{account.institution_name}</p>
                  <p className={cn("text-3xl font-bold", isLiability && "text-red-600 dark:text-red-400")}>
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                    {account.is_manual && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                    {account.last_synced && (
                      <span className="text-xs text-muted-foreground">
                        Synced {formatRelativeDate(account.last_synced)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Pie chart */}
              {categoryBreakdown.length > 0 && (
                <div className="hidden sm:flex items-center gap-3">
                  <div className="flex-shrink-0 cursor-pointer" onClick={() => setChartModalOpen(true)}>
                    <CategoryPieChart data={categoryBreakdown} />
                  </div>
                  <div className="space-y-1">
                    {categoryBreakdown.slice(0, 4).map((cat) => (
                      <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate max-w-[80px]">{cat.name}</span>
                        <span className="font-medium whitespace-nowrap">{formatCurrency(cat.total)}</span>
                      </div>
                    ))}
                    {categoryBreakdown.length > 4 && (
                      <button onClick={() => setChartModalOpen(true)} className="text-[10px] text-primary hover:underline">
                        +{categoryBreakdown.length - 4} more
                      </button>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" onClick={() => setChartModalOpen(true)} title="Expand">
                    <Expand className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 items-center">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {TIME_RANGES.map((r) => (
              <Button
                key={r.value}
                variant={timeRange === r.value ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => setTimeRange(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions ({transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No transactions found
              </p>
            ) : (
              <div className="space-y-1">
                {transactions.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    id={txn.id}
                    date={txn.date}
                    description={txn.description}
                    merchant_name={txn.merchant_name}
                    amount={txn.amount}
                    category_name={txn.category_name}
                    category_color={txn.category_color}
                    account_name={txn.account_name || account.name}
                    account_type={txn.account_type || account.type}
                    is_pending={txn.is_pending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expanded Pie Chart Modal */}
      <ChartModal open={chartModalOpen} onOpenChange={setChartModalOpen} title="Spending by Category">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-full">
          <div className="w-64 h-64">
            <CategoryPieChart data={categoryBreakdown} size={256} innerRadius={60} outerRadius={120} />
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {categoryBreakdown.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                </div>
                <span className="font-semibold">{formatCurrency(cat.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartModal>
    </>
  );
}
