"use client";

import { useEffect, useState } from "react";
import { AccountCard } from "./account-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: string;
  institution_name: string;
  last_synced: string | null;
}

export function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const data = await apiFetch<Account[]>("/api/accounts");
        setAccounts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load accounts");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
        {error}
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
        <Button asChild variant="outline" className="mt-4">
          <Link href={ROUTES.ACCOUNTS}>Add an account</Link>
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
