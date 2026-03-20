"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { TransactionRow } from "@/components/transactions/transaction-row";
import {
  Building2, CreditCard, Landmark, PiggyBank, Trash2, TrendingUp, Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

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

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Wallet; color: string }> = {
  checking: { label: "Checking", icon: Wallet, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  savings: { label: "Savings", icon: PiggyBank, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  credit: { label: "Credit Card", icon: CreditCard, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  investment: { label: "Investment", icon: TrendingUp, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  loan: { label: "Loan", icon: Landmark, color: "text-red-600 bg-red-100 dark:bg-red-900/30" },
};

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [acct, txns] = await Promise.all([
          apiFetch<AccountDetail>(`/api/accounts/${accountId}`),
          apiFetch<{ items: Transaction[] }>(
            `/api/transactions?account_id=${accountId}&limit=20`
          ),
        ]);
        setAccount(acct);
        setTransactions(txns.items);
      } catch {
        // error handled by API client
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [accountId]);

  const handleDeleteAccount = useCallback(async () => {
    if (!account) return;
    const msg = account.is_manual
      ? `Delete "${account.name}" and all its transactions?`
      : `Delete "${account.name}"? This will remove all transactions for this account. The bank link will remain (other accounts from ${account.institution_name} won't be affected).`;

    if (!confirm(msg)) return;

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
      ? `Unlink ${account.institution_name} and DELETE all accounts + transactions from this bank? This cannot be undone.`
      : `Unlink ${account.institution_name}? Accounts will be kept as manual accounts. Transaction history will be preserved.`;

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

  // Compute spending by category for pie chart (exclude income and transfers)
  // Must be before early returns to satisfy React hooks rules
  const categoryBreakdown = useMemo(() => {
    const incomeCategories = new Set(["Income", "Salary", "Freelance", "Other Income", "Investments"]);
    const transferCategories = new Set(["Transfer"]);
    const map: Record<string, { name: string; color: string; total: number }> = {};

    for (const txn of transactions) {
      const cat = txn.category_name || "Uncategorized";
      if (incomeCategories.has(cat) || transferCategories.has(cat)) continue;

      const amt = Math.abs(parseFloat(txn.amount));
      if (!map[cat]) {
        map[cat] = { name: cat, color: txn.category_color || "#6b7280", total: 0 };
      }
      map[cat].total += amt;
    }

    return Object.values(map)
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

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

  const config = TYPE_CONFIG[account.type] || { label: account.type, icon: Building2, color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30" };
  const Icon = config.icon;
  const isLiability = account.type === "credit" || account.type === "loan";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{account.name}</h1>
        <div className="flex gap-2">
          {!account.is_manual && account.plaid_item_id && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnlinkBank(false)}
                disabled={isDeleting}
              >
                Unlink (Keep Data)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnlinkBank(true)}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                Unlink & Delete
              </Button>
            </>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {account.institution_name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary">
                  {config.label}
                </Badge>
                {account.is_manual && (
                  <Badge variant="outline" className="text-[10px]">Manual</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-6">
            {/* Left: Balance + sync info */}
            <div>
              <p className={cn("text-3xl font-bold", isLiability && "text-red-600 dark:text-red-400")}>
                {formatCurrency(account.balance, account.currency)}
              </p>
              {account.last_synced && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last synced: {formatRelativeDate(account.last_synced)}
                </p>
              )}
            </div>

            {/* Right: Pie chart + legend */}
            {categoryBreakdown.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-28 h-28 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={50}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {categoryBreakdown.map((entry, i) => (
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
                </div>
                <div className="space-y-1 overflow-hidden">
                  {categoryBreakdown.slice(0, 5).map((cat) => (
                    <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate max-w-[80px]">{cat.name}</span>
                      <span className="font-medium whitespace-nowrap">
                        {formatCurrency(cat.total)}
                      </span>
                    </div>
                  ))}
                  {categoryBreakdown.length > 5 && (
                    <p className="text-[10px] text-muted-foreground">
                      +{categoryBreakdown.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No transactions for this account
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
  );
}
