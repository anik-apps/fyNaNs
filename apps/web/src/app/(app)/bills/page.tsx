"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BillList } from "@/components/bills/bill-list";
import { BillForm } from "@/components/bills/bill-form";

export default function BillsPage() {
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bills</h1>
        <BillForm
          onBillCreated={() =>
            queryClient.invalidateQueries({ queryKey: ["bills"] })
          }
        />
      </div>
      <BillList />
    </div>
  );
}
