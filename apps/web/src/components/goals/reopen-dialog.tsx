"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

export function ReopenDialog({
  goalId,
  currentAmount,
  onDone,
}: {
  goalId: string;
  currentAmount: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/goals/${goalId}/reopen`, {
        method: "POST",
        body: JSON.stringify({ new_target_amount: target }),
      });
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Raise Target</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Raise Target</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="text-sm text-muted-foreground">Current progress: ${Number(currentAmount).toFixed(2)}</div>
          <div>
            <Label htmlFor="new-target">New target amount</Label>
            <Input
              id="new-target"
              type="number"
              step="0.01"
              min="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Reopen"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
