"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BillCardProps {
  id: string;
  name: string;
  amount: string;
  frequency: string;
  next_due_date: string;
  is_auto_pay: boolean;
  days_until_due: number;
  category_name: string | null;
}

export function BillCard({
  name,
  amount,
  frequency,
  next_due_date,
  is_auto_pay,
  days_until_due,
  category_name,
}: BillCardProps) {
  function getStatusBadge() {
    if (days_until_due < 0)
      return <Badge variant="destructive">Overdue</Badge>;
    if (is_auto_pay) return <Badge variant="secondary">Auto-pay</Badge>;
    if (days_until_due === 0)
      return <Badge variant="destructive">Due today</Badge>;
    if (days_until_due <= 3)
      return (
        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
          Due soon
        </Badge>
      );
    return <Badge variant="outline">Upcoming</Badge>;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-medium">{name}</h3>
            <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{frequency}</span>
              {category_name && <span>| {category_name}</span>}
            </div>
          </div>
          <div className="text-right space-y-2">
            {getStatusBadge()}
            <p className="text-xs text-muted-foreground">
              {formatDate(next_due_date)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
