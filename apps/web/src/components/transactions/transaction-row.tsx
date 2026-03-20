"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Clock,
  Coffee,
  CreditCard,
  Film,
  Gift,
  GraduationCap,
  Heart,
  Home,
  type LucideIcon,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Income": Banknote,
  "Salary": Banknote,
  "Freelance": Banknote,
  "Investments": TrendingUp,
  "Other Income": Banknote,
  "Food & Drink": Utensils,
  "Groceries": ShoppingBag,
  "Restaurants": Coffee,
  "Transportation": Truck,
  "Gas": Zap,
  "Public Transit": Truck,
  "Rideshare": Truck,
  "Housing": Home,
  "Rent": Home,
  "Mortgage": Home,
  "Utilities": Zap,
  "Shopping": ShoppingBag,
  "Clothing": ShoppingBag,
  "Electronics": Package,
  "General": Package,
  "Entertainment": Film,
  "Streaming": Film,
  "Events": Film,
  "Hobbies": Film,
  "Health": Heart,
  "Doctor": Heart,
  "Pharmacy": Heart,
  "Fitness": Heart,
  "Insurance": CreditCard,
  "Education": GraduationCap,
  "Personal": Wallet,
  "Gifts & Donations": Gift,
  "Fees & Charges": Receipt,
  "Transfer": ArrowUpRight,
  "Uncategorized": Package,
};

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
  const isTransfer = category_name === "Transfer" || category_name === "Income";
  const CategoryIcon = CATEGORY_ICONS[category_name] || Package;
  const color = category_color || "#6b7280";

  return (
    <div className="flex items-center gap-3 py-3 px-2 hover:bg-accent/50 rounded-md transition-colors">
      {/* Category Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
          is_pending && "opacity-50"
        )}
        style={{ backgroundColor: `${color}20`, color }}
      >
        {is_pending ? (
          <Clock className="w-4 h-4" />
        ) : (
          <CategoryIcon className="w-4 h-4" />
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
      <div className="text-right flex items-center gap-1.5">
        {!isTransfer && (
          isExpense ? (
            <ArrowUpRight className="w-3 h-3 text-red-500 dark:text-red-400" />
          ) : (
            <ArrowDownLeft className="w-3 h-3 text-green-500 dark:text-green-400" />
          )
        )}
        <span
          className={cn(
            "text-sm font-semibold whitespace-nowrap",
            isTransfer
              ? "text-muted-foreground"
              : isExpense
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
          )}
        >
          {!isTransfer && (isExpense ? "-" : "+")}
          {formatCurrency(Math.abs(numAmount))}
        </span>
      </div>
    </div>
  );
}
