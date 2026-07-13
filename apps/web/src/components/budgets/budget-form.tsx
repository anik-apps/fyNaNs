"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { Budget } from "./types";

const budgetSchema = z.object({
  category_id: z.string().min(1, "Category is required"),
  amount_limit: z.string().min(1, "Amount is required"),
  period: z.string().min(1, "Period is required"),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

interface Category {
  id: string;
  name: string;
}

interface BudgetFormProps {
  editing?: Budget;
  onSaved?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BudgetForm({
  editing,
  onSaved,
  open: controlledOpen,
  onOpenChange,
}: BudgetFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category_id: editing?.category_id ?? "",
      amount_limit: editing?.amount_limit ?? "",
      period: editing?.period ?? "",
    },
  });

  useEffect(() => {
    // The backend PUT schema doesn't accept category_id, so the category
    // is locked in edit mode and the list isn't needed.
    if (open && !editing) {
      apiFetch<Category[]>("/api/categories")
        .then((data) => setCategories(data))
        .catch(() => {});
    }
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (data: BudgetFormData) =>
      editing
        ? apiFetch(`/api/budgets/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify({
              amount_limit: data.amount_limit,
              period: data.period,
            }),
          })
        : apiFetch("/api/budgets", {
            method: "POST",
            body: JSON.stringify(data),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!editing) reset();
      setOpen(false);
      onSaved?.();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save budget");
    },
  });

  function onSubmit(data: BudgetFormData) {
    setError(null);
    mutation.mutate(data);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Block Escape/overlay-close while a save is in flight — a remount
        // would allow a concurrent second submit (mirrors the delete guard).
        if (!mutation.isPending) setOpen(nextOpen);
      }}
    >
      {!editing && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit budget" : "Create Budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="budget-category">Category</Label>
            {editing ? (
              <Input
                id="budget-category"
                value={editing.category_name ?? ""}
                disabled
              />
            ) : (
              <Select
                value={watch("category_id")}
                onValueChange={(value) => setValue("category_id", value)}
              >
                <SelectTrigger id="budget-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.category_id && (
              <p className="text-sm text-destructive">
                {errors.category_id.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount_limit">Budget Amount</Label>
            <Input
              id="amount_limit"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount_limit")}
            />
            {errors.amount_limit && (
              <p className="text-sm text-destructive">
                {errors.amount_limit.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <Select
              value={watch("period")}
              onValueChange={(value) => setValue("period", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            {errors.period && (
              <p className="text-sm text-destructive">
                {errors.period.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {editing
              ? mutation.isPending
                ? "Saving..."
                : "Save"
              : mutation.isPending
                ? "Creating..."
                : "Create Budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
