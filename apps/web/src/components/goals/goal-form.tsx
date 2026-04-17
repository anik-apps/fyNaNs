"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH } from "@fynans/shared-types";
import type { SavingsGoal } from "./types";

interface AccountSummary {
  id: string;
  name: string;
  type: string;
}

const goalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(MAX_NAME_LENGTH),
  target_amount: z.string().min(1, "Target is required"),
  target_date: z.string().optional(),
  linked_account_id: z.string().optional(),
  notes: z.string().max(MAX_NOTES_LENGTH).optional(),
});

type GoalFormData = z.infer<typeof goalSchema>;

export interface GoalFormProps {
  editing?: SavingsGoal;
  onSaved: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function GoalForm({
  editing,
  onSaved,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: GoalFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: editing?.name ?? "",
      target_amount: editing ? editing.target_amount : "",
      target_date: editing?.target_date ?? "",
      linked_account_id: editing?.linked_account?.id ?? "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    apiFetch<AccountSummary[]>("/api/accounts")
      .then((all) =>
        setAccounts(
          all.filter((a) => a.type === "checking" || a.type === "savings")
        )
      )
      .catch(() => {});
  }, [open]);

  async function onSubmit(data: GoalFormData) {
    setError(null);
    const body: Record<string, unknown> = {
      name: data.name,
      target_amount: data.target_amount,
    };
    if (data.target_date) body.target_date = data.target_date;
    if (data.linked_account_id) body.linked_account_id = data.linked_account_id;
    if (data.notes) body.notes = data.notes;

    try {
      if (editing) {
        await apiFetch(`/api/goals/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/goals", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      reset();
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal");
    }
  }

  const defaultTrigger = (
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      New Goal
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Goal" : "New Savings Goal"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              maxLength={MAX_NAME_LENGTH}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-rose-600">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="goal-target">Target amount</Label>
            <Input
              id="goal-target"
              type="number"
              step="0.01"
              min="0.01"
              {...register("target_amount")}
            />
            {errors.target_amount && (
              <p className="text-sm text-rose-600">
                {errors.target_amount.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="goal-date">Target date (optional)</Label>
            <Input
              id="goal-date"
              type="date"
              min={editing ? undefined : new Date().toISOString().slice(0, 10)}
              {...register("target_date")}
            />
          </div>
          <div>
            <Label>Linked account (optional)</Label>
            <Select
              value={watch("linked_account_id") ?? ""}
              onValueChange={(v) =>
                setValue("linked_account_id", v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Unlinked (manual contributions)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unlinked</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="goal-notes">Notes (optional)</Label>
            <Textarea
              id="goal-notes"
              maxLength={MAX_NOTES_LENGTH}
              {...register("notes")}
            />
          </div>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
