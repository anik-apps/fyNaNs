"use client";

import { useEffect, useState, useCallback } from "react";
import { TransactionRow } from "./transaction-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: string;
  category_name: string;
  category_color: string;
  account_name: string;
  is_pending: boolean;
}

interface TransactionListProps {
  search: string;
  category: string;
  accountId: string;
}

export function TransactionList({
  search,
  category,
  accountId,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchTransactions = useCallback(
    async (nextCursor?: string) => {
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (search) params.set("search", search);
      if (category && category !== "all") params.set("category_id", category);
      if (accountId && accountId !== "all")
        params.set("account_id", accountId);
      if (nextCursor) params.set("cursor", nextCursor);

      const data = await apiFetch<{
        items: Transaction[];
        next_cursor: string | null;
      }>(`/api/transactions?${params.toString()}`);

      return data;
    },
    [search, category, accountId]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchTransactions();
        if (!cancelled) {
          setTransactions(data.items);
          setCursor(data.next_cursor);
          setHasMore(!!data.next_cursor);
        }
      } catch {
        // error handled by API client
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchTransactions]);

  async function loadMore() {
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      const data = await fetchTransactions(cursor);
      setTransactions((prev) => [...prev, ...data.items]);
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } catch {
      // handled
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No transactions found</p>
        <p className="text-sm mt-1">
          {search
            ? "Try adjusting your search or filters."
            : "Import transactions or link a bank to get started."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y">
        {transactions.map((txn) => (
          <TransactionRow key={txn.id} {...txn} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
