import React from "react";
import { Text, type TextStyle } from "react-native";
import { formatCurrency } from "@/src/lib/utils";

interface CurrencyProps {
  amount: number | string;
  currency?: string;
  style?: TextStyle;
}

export function Currency({ amount, currency = "USD", style }: CurrencyProps) {
  return <Text style={style}>{formatCurrency(amount, currency)}</Text>;
}
