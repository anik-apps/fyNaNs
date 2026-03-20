"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { TransactionRow } from "@/components/transactions/transaction-row";
import {
  Building2, CreditCard, Landmark, PiggyBank, TrendingUp, Wallet,
} from "lucide-react";

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

  const config = TYPE_CONFIG[account.type] || { label: account.type, icon: Building2, color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30" };
  const Icon = config.icon;
  const isLiability = account.type === "credit" || account.type === "loan";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{account.name}</h1>

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
              <Badge variant="secondary" className="mt-0.5">
                {config.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className={cn("text-3xl font-bold", isLiability && "text-red-600 dark:text-red-400")}>
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
