"use client";

import { useState } from "react";
import { AccountList } from "@/components/accounts/account-list";
import { AddAccountDialog } from "@/components/accounts/add-account-dialog";
import { PlaidLinkButton } from "@/components/accounts/plaid-link-button";

export default function AccountsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleAccountsChanged() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <div className="flex gap-2">
          <PlaidLinkButton onSuccess={handleAccountsChanged} />
          <AddAccountDialog onAccountAdded={handleAccountsChanged} />
        </div>
      </div>
      <AccountList key={refreshKey} />
    </div>
  );
}
