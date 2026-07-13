"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import { type Contribution } from "./types";

export function ContributionsPanel({
  goalId,
  contributions,
  onChanged,
}: {
  goalId: string;
  contributions: Contribution[];
  onChanged: () => void;
}) {
  // Empty on first render (SSR + client init) to avoid hydration mismatch;
  // populated on mount.
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Contribution | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/goals/${goalId}/contributions`, {
        method: "POST",
        body: JSON.stringify({ contribution_date: date, amount }),
      });
      setAmount("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSubmitting(false);
    }
  }

  async function del(cid: string) {
    setDeletingId(cid);
    setDeleteError(null);
    try {
      await apiFetch(`/api/goals/${goalId}/contributions/${cid}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete contribution");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-semibold">Contributions</h2>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[180px]" />
        <Input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Button type="submit" disabled={submitting}>Add</Button>
      </form>
      {error && <div className="mb-2 text-sm text-destructive">{error}</div>}
      {deleteError && <div className="mb-2 text-sm text-destructive">{deleteError}</div>}
      {contributions.length === 0 ? (
        <div className="text-sm text-muted-foreground">No contributions yet.</div>
      ) : (
        <ul className="divide-y divide-border">
          {contributions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium">{formatCurrency(c.amount)}</div>
                <div className="text-xs text-muted-foreground">{c.contribution_date}{c.note ? ` · ${c.note}` : ""}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmTarget(c)}
                disabled={deletingId === c.id}
                className="text-destructive"
              >
                {deletingId === c.id ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contribution?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget
                ? `This will permanently remove the ${formatCurrency(confirmTarget.amount)} contribution from ${confirmTarget.contribution_date} and lower this goal's progress. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (confirmTarget) del(confirmTarget.id);
                setConfirmTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
