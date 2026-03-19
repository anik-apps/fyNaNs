"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface NetWorthCardProps {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
}

export function NetWorthCard({
  totalAssets,
  totalLiabilities,
  netWorth,
}: NetWorthCardProps) {
  const nw = parseFloat(netWorth);
  const isPositive = nw > 0;
  const isZero = nw === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-3xl font-bold",
              isPositive
                ? "text-green-600"
                : isZero
                  ? ""
                  : "text-red-600"
            )}
          >
            {formatCurrency(netWorth)}
          </span>
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : isZero ? (
            <Minus className="h-5 w-5 text-muted-foreground" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600" />
          )}
        </div>
        <div className="flex gap-6 mt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Assets</span>
            <p className="font-medium text-green-600">
              {formatCurrency(totalAssets)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Liabilities</span>
            <p className="font-medium text-red-600">
              {formatCurrency(totalLiabilities)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
