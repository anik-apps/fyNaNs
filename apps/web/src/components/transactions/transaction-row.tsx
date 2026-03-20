"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
} from "lucide-react";

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
    <div className="flex items-center gap-3 py-3 px-2 hover:bg-accent/50 rounded-md transition-colors">
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
          is_pending
            ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
            : isExpense
              ? "bg-red-100 text-red-600 dark:bg-red-900/30"
              : "bg-green-100 text-green-600 dark:bg-green-900/30"
        )}
      >
        {is_pending ? (
          <Clock className="w-4 h-4" />
        ) : isExpense ? (
          <ArrowUpRight className="w-4 h-4" />
        ) : (
          <ArrowDownLeft className="w-4 h-4" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {merchant_name || description}
          </p>
          {is_pending && (
            <Badge variant="outline" className="text-[10px] py-0">
              Pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: category_color || '#6b7280' }}
          />
          <span className="text-xs text-muted-foreground truncate">
            {category_name}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground truncate">
            {account_name}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeDate(date)}
          </span>
        </div>
      </div>

      {/* Amount */}
      <span
        className={cn(
          "text-sm font-semibold ml-2 whitespace-nowrap",
          isExpense
            ? "text-red-600 dark:text-red-400"
            : "text-green-600 dark:text-green-400"
        )}
      >
        {isExpense ? "-" : "+"}
        {formatCurrency(Math.abs(numAmount))}
      </span>
    </div>
  );
}
