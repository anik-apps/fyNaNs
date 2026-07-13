"use client";

import { useState } from "react";
import { BillList } from "@/components/bills/bill-list";
import { BillForm } from "@/components/bills/bill-form";

export default function BillsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bills</h1>
        <BillForm open={createOpen} onOpenChange={setCreateOpen} />
      </div>
      <BillList onCreate={() => setCreateOpen(true)} />
    </div>
  );
}
