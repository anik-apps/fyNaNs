"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
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
  "Income": Banknote, "Salary": Banknote, "Freelance": Banknote,
  "Investments": TrendingUp, "Other Income": Banknote,
  "Food & Drink": Utensils, "Groceries": ShoppingBag, "Restaurants": Coffee,
  "Transportation": Truck, "Gas": Zap, "Public Transit": Truck, "Rideshare": Truck,
  "Housing": Home, "Rent": Home, "Mortgage": Home, "Utilities": Zap,
  "Shopping": ShoppingBag, "Clothing": ShoppingBag, "Electronics": Package, "General": Package,
  "Entertainment": Film, "Streaming": Film, "Events": Film, "Hobbies": Film,
  "Health": Heart, "Doctor": Heart, "Pharmacy": Heart, "Fitness": Heart,
  "Insurance": CreditCard, "Education": GraduationCap,
  "Personal": Wallet, "Gifts & Donations": Gift, "Fees & Charges": Receipt,
  "Transfer": ArrowLeftRight, "Uncategorized": Package,
};

const INCOME_CATEGORIES = new Set(["Income", "Salary", "Freelance", "Other Income", "Investments"]);
const TRANSFER_CATEGORIES = new Set(["Transfer"]);
const LIABILITY_ACCOUNT_TYPES = new Set(["credit", "loan"]);

interface TransactionRowProps {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string;
  category_name: string;
  category_color: string;
  account_name: string;
  account_type?: string;
  is_pending: boolean;
}

/**
 * Determine how to display a transaction amount.
 *
 * Plaid sign conventions differ by account type:
 *   - Depository (checking/savings): positive = money OUT, negative = money IN
 *   - Credit cards: ALL transactions are positive in sandbox.
 *     Charges (expenses) and payments (TRANSFER_OUT) are both positive.
 *     Only category distinguishes them.
 *
 * NOTE: Plaid sandbox credit card data may not accurately reflect real-world
 * sign conventions. In production, credit card transactions may have negative
 * amounts for credits/refunds. This logic handles both cases.
 */
function getDisplayType(
  amount: number,
  categoryName: string,
  accountType: string,
): "income" | "expense" | "transfer" {
  if (TRANSFER_CATEGORIES.has(categoryName)) return "transfer";
  if (INCOME_CATEGORIES.has(categoryName)) return "income";

  if (LIABILITY_ACCOUNT_TYPES.has(accountType)) {
    // Credit/loan: positive = charge (expense), negative = payment/credit (income-like)
    return amount < 0 ? "income" : "expense";
  }

  // Depository: positive = money out (expense), negative = money in (income)
  return amount < 0 ? "income" : "expense";
}

export function TransactionRow({
  date,
  description,
  merchant_name,
  amount,
  category_name,
  category_color,
  account_name,
  account_type = "checking",
  is_pending,
}: TransactionRowProps) {
  const numAmount = parseFloat(amount);
  const absAmount = Math.abs(numAmount);
  const displayType = getDisplayType(numAmount, category_name, account_type);

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
        {displayType === "income" && (
          <ArrowDownLeft className="w-3 h-3 text-green-500 dark:text-green-400" />
        )}
        {displayType === "expense" && (
          <ArrowUpRight className="w-3 h-3 text-red-500 dark:text-red-400" />
        )}
        {displayType === "transfer" && (
          <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
        )}
        <span
          className={cn(
            "text-sm font-semibold whitespace-nowrap",
            displayType === "transfer" && "text-muted-foreground",
            displayType === "income" && "text-green-600 dark:text-green-400",
            displayType === "expense" && "text-red-600 dark:text-red-400",
          )}
        >
          {displayType === "income" ? "+" : displayType === "expense" ? "-" : ""}
          {formatCurrency(absAmount)}
        </span>
      </div>
    </div>
  );
}
