"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import {
  Building2,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";

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

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Wallet; color: string }> = {
  checking: { label: "Checking", icon: Wallet, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  savings: { label: "Savings", icon: PiggyBank, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  credit: { label: "Credit Card", icon: CreditCard, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  investment: { label: "Investment", icon: TrendingUp, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  loan: { label: "Loan", icon: Landmark, color: "text-red-600 bg-red-100 dark:bg-red-900/30" },
};

const LIABILITY_TYPES = new Set(["credit", "loan"]);

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
            {types.map(([type, accounts]) => {
              const config = TYPE_CONFIG[type] || { label: type, icon: Building2, color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30" };
              const TypeIcon = config.icon;
              const isLiability = LIABILITY_TYPES.has(type);

              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center", config.color)}>
                      <TypeIcon className="w-3 h-3" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {config.label}
                    </p>
                  </div>
                  <div className="space-y-2 pl-7">
                    {accounts.map((acct) => (
                      <Link
                        key={acct.id}
                        href={`/accounts/${acct.id}`}
                        className="flex justify-between items-center hover:bg-accent/50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{acct.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {acct.institution_name}
                          </p>
                        </div>
                        <p className={cn(
                          "text-sm font-semibold",
                          isLiability && "text-red-600 dark:text-red-400"
                        )}>
                          {formatCurrency(acct.balance)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
