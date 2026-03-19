"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

interface BillItem {
  id: string;
  name: string;
  amount: string;
  next_due_date: string;
  is_auto_pay: boolean;
  days_until_due: number;
}

interface UpcomingBillsProps {
  bills: BillItem[];
}

export function UpcomingBills({ bills }: UpcomingBillsProps) {
  function getDueBadge(days: number, isAutoPay: boolean) {
    if (isAutoPay) return <Badge variant="secondary">Auto-pay</Badge>;
    if (days === 0) return <Badge variant="destructive">Due today</Badge>;
    if (days === 1) return <Badge variant="destructive">Due tomorrow</Badge>;
    return <Badge variant="outline">In {days} days</Badge>;
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Upcoming Bills (7 days)
        </CardTitle>
        <Link
          href={ROUTES.BILLS}
          className="text-xs text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No bills due this week
          </p>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{bill.name}</p>
                  {getDueBadge(bill.days_until_due, bill.is_auto_pay)}
                </div>
                <p className="text-sm font-medium">
                  {formatCurrency(bill.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
