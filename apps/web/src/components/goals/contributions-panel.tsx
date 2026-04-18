"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, type Contribution } from "./types";

export function ContributionsPanel({
  goalId,
  contributions,
  onChanged,
}: {
  goalId: string;
  contributions: Contribution[];
  onChanged: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    await apiFetch(`/api/goals/${goalId}/contributions/${cid}`, { method: "DELETE" });
    onChanged();
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
      {contributions.length === 0 ? (
        <div className="text-sm text-muted-foreground">No contributions yet.</div>
      ) : (
        <ul className="divide-y divide-border">
          {contributions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium">${money(c.amount)}</div>
                <div className="text-xs text-muted-foreground">{c.contribution_date}{c.note ? ` · ${c.note}` : ""}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => del(c.id)} className="text-destructive">Delete</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
