"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { TransactionRow } from "@/components/transactions/transaction-row";

interface TransactionItem {
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

interface RecentTransactionsProps {
  transactions: TransactionItem[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Transactions
        </CardTitle>
        <Link
          href={ROUTES.TRANSACTIONS}
          className="text-xs text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No transactions yet
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
                account_name={txn.account_name}
                account_type={txn.account_type}
                is_pending={txn.is_pending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
