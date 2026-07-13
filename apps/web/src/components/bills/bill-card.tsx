"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardActionsMenu } from "@/components/shared/card-actions-menu";
import { BillForm } from "./bill-form";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Bill } from "./types";

interface BillCardProps {
  bill: Bill;
}

// GET /api/bills doesn't return days_until_due — derive it from
// next_due_date (a YYYY-MM-DD date string), comparing calendar days.
function getDaysUntilDue(nextDueDate: string): number {
  const [year, month, day] = nextDueDate.slice(0, 10).split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function BillCard({ bill }: BillCardProps) {
  const { name, amount, frequency, next_due_date, is_auto_pay } = bill;
  const days_until_due = getDaysUntilDue(next_due_date);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/bills/${bill.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteOpen(false);
    },
  });

  function getStatusBadge() {
    if (days_until_due < 0)
      return <Badge variant="destructive">Overdue</Badge>;
    if (is_auto_pay) return <Badge variant="secondary">Auto-pay</Badge>;
    if (days_until_due === 0)
      return <Badge variant="destructive">Due today</Badge>;
    if (days_until_due <= 3)
      return (
        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
          Due soon
        </Badge>
      );
    return <Badge variant="outline">Upcoming</Badge>;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-medium">{name}</h3>
            <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{frequency}</span>
            </div>
          </div>
          <div className="flex items-start gap-1">
            <div className="text-right space-y-2">
              {getStatusBadge()}
              <p className="text-xs text-muted-foreground">
                {formatDate(next_due_date)}
              </p>
            </div>
            <CardActionsMenu
              label={`Actions for ${name}`}
              onEdit={() => setEditOpen(true)}
              deleteTitle={`Delete "${name}"?`}
              deleteDescription="This removes the bill permanently."
              deleteOpen={deleteOpen}
              onDeleteOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) deleteMutation.reset();
              }}
              onConfirmDelete={() => deleteMutation.mutate()}
              isDeleting={deleteMutation.isPending}
              deleteError={
                deleteMutation.error
                  ? deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : "Failed to delete bill"
                  : null
              }
            />
          </div>
        </div>
      </CardContent>
      {editOpen && (
        <BillForm editing={bill} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </Card>
  );
}
