"use client";

import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { TransactionRow } from "./transaction-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

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

interface TransactionPage {
  items: Transaction[];
  next_cursor: string | null;
}

interface TransactionListProps {
  search: string;
  category: string;
  accountId: string;
  dateFrom?: string;
}

function formatDateGroupHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupTransactionsByDate(
  transactions: Transaction[]
): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  for (const txn of transactions) {
    const dateKey = txn.date.slice(0, 10); // YYYY-MM-DD
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(txn);
  }
  return groups;
}

function fetchTransactionPage(
  filters: {
    search: string;
    category: string;
    accountId: string;
    dateFrom?: string;
  },
  cursor: string | null
): Promise<TransactionPage> {
  const params = new URLSearchParams();
  params.set("limit", "30");
  if (filters.search) params.set("search", filters.search);
  if (filters.category && filters.category !== "all")
    params.set("category_id", filters.category);
  if (filters.accountId && filters.accountId !== "all")
    params.set("account_id", filters.accountId);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (cursor) params.set("cursor", cursor);

  return apiFetch<TransactionPage>(`/api/transactions?${params.toString()}`);
}

export function TransactionList({
  search,
  category,
  accountId,
  dateFrom,
}: TransactionListProps) {
  const {
    data,
    isPending,
    isError,
    error,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["transactions", { search, category, accountId, dateFrom }],
    queryFn: ({ pageParam }) =>
      fetchTransactionPage({ search, category, accountId, dateFrom }, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    // Keep the previous results visible (dimmed) while a filter/search change
    // refetches, instead of blanking the list back to skeletons.
    placeholderData: keepPreviousData,
  });

  const transactions = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );
  const grouped = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions]
  );
  const sortedDateKeys = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
        {error instanceof Error ? error.message : "Failed to load transactions"}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ArrowLeftRight className="mx-auto h-10 w-10 mb-3 opacity-50" />
        <p className="text-lg font-medium">No transactions found</p>
        <p className="text-sm mt-1">
          {search
            ? "Try adjusting your search or filters."
            : "Import transactions or link a bank to get started."}
        </p>
        {!search && (
          <Button asChild variant="outline" className="mt-4">
            <Link href={ROUTES.ACCOUNTS}>Link an account</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        isPlaceholderData ? "opacity-50 transition-opacity" : undefined
      }
    >
      {sortedDateKeys.map((dateKey) => (
        <div key={dateKey} className="mb-4">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-1.5 px-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {formatDateGroupHeader(dateKey)}
            </h3>
          </div>
          <div className="space-y-1">
            {grouped[dateKey].map((txn) => (
              <TransactionRow key={txn.id} {...txn} />
            ))}
          </div>
        </div>
      ))}
      {hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
