"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";

interface TransactionRowProps {
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

export function TransactionRow({
  date,
  description,
  merchant_name,
  amount,
  category_name,
  category_color,
  account_name,
  is_pending,
}: TransactionRowProps) {
  const numAmount = parseFloat(amount);
  const isExpense = numAmount > 0;

  return (
    <div className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {merchant_name || description}
          </p>
          {is_pending && (
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
              backgroundColor: `${category_color}20`,
              color: category_color,
            }}
          >
            {category_name}
          </Badge>
          <span className="text-xs text-muted-foreground">{account_name}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(date)}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "text-sm font-medium ml-4 whitespace-nowrap",
          isExpense ? "text-red-600" : "text-green-600"
        )}
      >
        {isExpense ? "-" : "+"}
        {formatCurrency(Math.abs(numAmount))}
      </span>
    </div>
  );
}
