"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  onBudgetCreated?: () => void;
}

export function BudgetForm({ onBudgetCreated }: BudgetFormProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
  });

  useEffect(() => {
    if (open) {
      apiFetch<Category[]>("/api/categories")
        .then((data) => setCategories(data))
        .catch(() => {});
    }
  }, [open]);

  async function onSubmit(data: BudgetFormData) {
    setError(null);
    try {
      await apiFetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify(data),
      });
      reset();
      setOpen(false);
      onBudgetCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create budget");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              onValueChange={(value) => setValue("category_id", value)}
            >
              <SelectTrigger>
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
            <Select onValueChange={(value) => setValue("period", value)}>
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
