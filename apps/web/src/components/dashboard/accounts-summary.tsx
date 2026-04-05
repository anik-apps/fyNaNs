"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import {
  Building2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ACCOUNT_TYPE_CONFIG } from "@/lib/account-type-config";

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

const LIABILITY_TYPES = new Set(["credit", "loan"]);

function sumBalances(accounts: AccountItem[]): number {
  return accounts.reduce((sum, a) => sum + parseFloat(a.balance || "0"), 0);
}

export function AccountsSummary({ accountsByType }: AccountsSummaryProps) {
  const types = Object.entries(accountsByType).filter(
    ([, accounts]) => accounts.length > 0
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleType(type: string) {
    setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }));
  }

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
          <div className="space-y-2">
            {types.map(([type, accounts]) => {
              const config = ACCOUNT_TYPE_CONFIG[type] || { label: type, icon: Building2, color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30" };
              const TypeIcon = config.icon;
              const isLiability = LIABILITY_TYPES.has(type);
              const isOpen = !collapsed[type];
              const total = sumBalances(accounts);

              return (
                <div key={type}>
                  <button
                    onClick={() => toggleType(type)}
                    className="w-full flex items-center justify-between py-2 px-1 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div className={cn("w-5 h-5 rounded flex items-center justify-center", config.color)}>
                        <TypeIcon className="w-3 h-3" />
                      </div>
                      <span className="text-sm font-medium">
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({accounts.length})
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm font-semibold",
                      isLiability && "text-red-600 dark:text-red-400"
                    )}>
                      {formatCurrency(total)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="space-y-1 pl-11 pb-1">
                      {accounts.map((acct) => (
                        <Link
                          key={acct.id}
                          href={`/accounts/${acct.id}`}
                          className="flex justify-between items-center hover:bg-accent/50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                        >
                          <div>
                            <p className="text-sm">{acct.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {acct.institution_name}
                            </p>
                          </div>
                          <p className={cn(
                            "text-sm",
                            isLiability && "text-red-600 dark:text-red-400"
                          )}>
                            {formatCurrency(acct.balance)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
