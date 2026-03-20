"use client";

import { useState, useEffect, useMemo } from "react";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { ImportDialog } from "@/components/transactions/import-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { apiFetch } from "@/lib/api-client";

interface Category {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
}

function getDateFromRange(range: string): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  const map: Record<string, number> = {
    "7d": 7, "30d": 30, "90d": 90, "6m": 180, "1y": 365,
  };
  const days = map[range];
  if (!days) return undefined;
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [timeRange, setTimeRange] = useState("30d");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterError, setFilterError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const dateFrom = useMemo(() => getDateFromRange(timeRange), [timeRange]);

  useEffect(() => {
    async function fetchFilters() {
      try {
        setFilterError(null);
        const [cats, accts] = await Promise.all([
          apiFetch<Category[]>("/api/categories"),
          apiFetch<Account[]>("/api/accounts"),
        ]);
        setCategories(cats);
        setAccounts(accts);
      } catch (err) {
        setFilterError(
          err instanceof Error ? err.message : "Failed to load filters"
        );
      }
    }
    fetchFilters();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <ImportDialog onImported={() => setRefreshKey((k) => k + 1)} />
      </div>
      {filterError && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
          {filterError}
        </div>
      )}
      <TransactionFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        accountId={accountId}
        onAccountChange={setAccountId}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        categories={categories}
        accounts={accounts}
      />
      <TransactionList
        key={`${refreshKey}-${timeRange}`}
        search={debouncedSearch}
        category={category}
        accountId={accountId}
        dateFrom={dateFrom}
      />
    </div>
  );
}
