"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface AccountCardProps {
  id: string;
  name: string;
  type: string;
  balance: string;
  institution_name: string;
  last_synced: string | null;
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

export function AccountCard({
  id,
  name,
  type,
  balance,
  institution_name,
  last_synced,
}: AccountCardProps) {
  return (
    <Link
      href={`/accounts/${id}`}
      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{name}</p>
          <Badge variant="secondary" className="text-xs">
            {TYPE_LABELS[type] || type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {institution_name}
          {last_synced && (
            <span className="ml-2">
              Last synced:{" "}
              {new Date(last_synced).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </p>
      </div>
      <p className="text-sm font-semibold ml-4">{formatCurrency(balance)}</p>
    </Link>
  );
}
