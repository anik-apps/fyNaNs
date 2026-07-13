"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccountList } from "@/components/accounts/account-list";
import { AddAccountDialog } from "@/components/accounts/add-account-dialog";
import { PlaidLinkButton } from "@/components/accounts/plaid-link-button";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleAccountsChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }, [queryClient]);

  const handleSyncAll = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiFetch<{
        added: number;
        modified: number;
        removed: number;
        items_synced: number;
      }>("/api/plaid/sync-all", { method: "POST" });
      setSyncResult(
        `Synced ${result.items_synced} bank(s): ${result.added} new, ${result.modified} updated, ${result.removed} removed`
      );
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } catch {
      setSyncResult("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            {isSyncing ? "Syncing..." : "Sync All"}
          </Button>
          <PlaidLinkButton onSuccess={handleAccountsChanged} />
          <AddAccountDialog onAccountAdded={handleAccountsChanged} />
        </div>
      </div>
      {syncResult && (
        <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
          {syncResult}
        </p>
      )}
      <AccountList />
    </div>
  );
}
