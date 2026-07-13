"use client";

import { useQuery } from "@tanstack/react-query";
import { AccountCard } from "./account-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { Wallet } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: string;
  institution_name: string;
  last_synced: string | null;
}

interface AccountListProps {
  onCreate?: () => void;
}

export function AccountList({ onCreate }: AccountListProps) {
  const { data: accounts, isPending, isError, error } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiFetch<Account[]>("/api/accounts"),
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
        {error instanceof Error ? error.message : "Failed to load accounts"}
      </div>
    );
  }

  // Group by institution
  const grouped = accounts.reduce(
    (acc, account) => {
      const key = account.institution_name || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(account);
      return acc;
    },
    {} as Record<string, Account[]>
  );

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Wallet className="mx-auto h-10 w-10 mb-3 opacity-50" />
        <p className="text-lg font-medium">No accounts yet</p>
        <p className="text-sm mt-1">Link a bank or add a manual account to get started.</p>
        <Button variant="outline" className="mt-4" onClick={onCreate}>
          Add an account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([institution, accts]) => (
        <div key={institution}>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {institution}
          </h3>
          <div className="space-y-2">
            {accts.map((account) => (
              <AccountCard key={account.id} {...account} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
