"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

interface TransactionItem {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string;
  category_name: string;
  category_color: string;
  account_name: string;
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {txn.merchant_name || txn.description}
                      </p>
                      {txn.is_pending && (
                        <Badge variant="outline" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
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
  );
}
