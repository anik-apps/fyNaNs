"use client";

import { useState, useEffect } from "react";
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

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    async function fetchFilters() {
      try {
        const [cats, accts] = await Promise.all([
          apiFetch<{ items: Category[] }>("/api/categories"),
          apiFetch<{ items: Account[] }>("/api/accounts"),
        ]);
        setCategories(cats.items);
        setAccounts(accts.items);
      } catch {
        // silently fail - filters just won't populate
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
      <TransactionFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        accountId={accountId}
        onAccountChange={setAccountId}
        categories={categories}
        accounts={accounts}
      />
      <TransactionList
        key={refreshKey}
        search={debouncedSearch}
        category={category}
        accountId={accountId}
      />
    </div>
  );
}
