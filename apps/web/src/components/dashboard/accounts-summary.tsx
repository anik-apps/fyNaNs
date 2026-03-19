"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

interface AccountItem {
  id: string;
  name: string;
  institution_name: string;
  type: string;
  balance: string;
}

interface AccountsSummaryProps {
  accountsByType: Record<string, AccountItem[]>;
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

export function AccountsSummary({ accountsByType }: AccountsSummaryProps) {
  const types = Object.entries(accountsByType).filter(
    ([, accounts]) => accounts.length > 0
  );

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Accounts
        </CardTitle>
        <Link
          href={ROUTES.ACCOUNTS}
          className="text-xs text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No accounts linked yet
          </p>
        ) : (
          <div className="space-y-4">
            {types.map(([type, accounts]) => (
              <div key={type}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {TYPE_LABELS[type] || type}
                </p>
                <div className="space-y-2">
                  {accounts.map((acct) => (
                    <div
                      key={acct.id}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-medium">{acct.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {acct.institution_name}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatCurrency(acct.balance)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
