"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

interface AccountDetail {
  id: string;
  name: string;
  type: string;
  balance: string;
  institution_name: string;
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
  is_pending: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  mortgage: "Mortgage",
  other: "Other",
};

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{account.name}</h1>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {account.institution_name}
            </CardTitle>
            <Badge variant="secondary">
              {TYPE_LABELS[account.type] || account.type}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {formatCurrency(account.balance, account.currency)}
          </p>
          {account.last_synced && (
            <p className="text-xs text-muted-foreground mt-1">
              Last synced: {formatRelativeDate(account.last_synced)}
            </p>
          )}
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
            <div className="space-y-3">
              {transactions.map((txn) => {
                const amount = parseFloat(txn.amount);
                const isExpense = amount > 0;
                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {txn.merchant_name || txn.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          style={{
                            backgroundColor: `${txn.category_color}20`,
                            color: txn.category_color,
                          }}
                        >
                          {txn.category_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeDate(txn.date)}
                        </span>
                        {txn.is_pending && (
                          <Badge variant="outline" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium ml-2",
                        isExpense ? "text-red-600" : "text-green-600"
                      )}
                    >
                      {isExpense ? "-" : "+"}
                      {formatCurrency(Math.abs(amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
