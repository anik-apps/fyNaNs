"use client";

import { useQuery } from "@tanstack/react-query";
import { BillCard } from "./bill-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import type { Bill } from "./types";

export function BillList() {
  const { data: bills, isPending, isError, error, refetch } = useQuery({
    queryKey: ["bills"],
    queryFn: () => apiFetch<Bill[]>("/api/bills"),
  });

  if (isPending) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md flex items-center justify-between gap-4">
        <span>
          {error instanceof Error ? error.message : "Failed to load bills"}
        </span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
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
        <BillCard key={bill.id} bill={bill} />
      ))}
    </div>
  );
}
