"use client";

import { useEffect, useState } from "react";
import { BillCard } from "./bill-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

interface Bill {
  id: string;
  name: string;
  amount: string;
  frequency: string;
  next_due_date: string;
  is_auto_pay: boolean;
  days_until_due: number;
  category_name: string | null;
}

export function BillList() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBills() {
      try {
        const data = await apiFetch<Bill[]>("/api/bills");
        setBills(data);
      } catch {
        // handled by API client
      } finally {
        setIsLoading(false);
      }
    }
    fetchBills();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="mx-auto h-10 w-10 mb-3 opacity-50" />
        <p className="text-lg font-medium">No bills yet</p>
        <p className="text-sm mt-1">
          Add your recurring bills to stay on top of payments.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={ROUTES.BILLS}>Add a bill</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {bills.map((bill) => (
        <BillCard key={bill.id} {...bill} />
      ))}
    </div>
  );
}
