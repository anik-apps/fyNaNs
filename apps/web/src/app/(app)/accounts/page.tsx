"use client";

import { AccountList } from "@/components/accounts/account-list";
import { AddAccountDialog } from "@/components/accounts/add-account-dialog";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";

export default function AccountsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <Landmark className="h-4 w-4 mr-2" />
            Link Bank
          </Button>
          <AddAccountDialog />
        </div>
      </div>
      <AccountList />
    </div>
  );
}
