import { formatCurrency } from "@/lib/utils";

interface CurrencyProps {
  amount: number | string;
  currency?: string;
  className?: string;
}

export function Currency({ amount, currency = "USD", className }: CurrencyProps) {
  return <span className={className}>{formatCurrency(amount, currency)}</span>;
}
