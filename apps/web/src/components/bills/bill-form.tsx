"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { Bill } from "./types";

const billSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.string().min(1, "Amount is required"),
  frequency: z.string().min(1, "Frequency is required"),
  next_due_date: z.string().min(1, "Next due date is required"),
  day_of_month: z.string().optional(),
  is_auto_pay: z.boolean().default(false),
  reminder_days: z.string().optional(),
});

type BillFormData = z.infer<typeof billSchema>;

interface BillFormProps {
  editing?: Bill;
  onSaved?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BillForm({
  editing,
  onSaved,
  open: controlledOpen,
  onOpenChange,
}: BillFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [error, setError] = useState<string | null>(null);
  const [isAutoPay, setIsAutoPay] = useState(editing?.is_auto_pay ?? false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: editing?.name ?? "",
      amount: editing?.amount ?? "",
      frequency: editing?.frequency ?? "",
      next_due_date: editing?.next_due_date?.slice(0, 10) ?? "",
      day_of_month:
        editing?.day_of_month != null ? String(editing.day_of_month) : "",
      reminder_days:
        editing?.reminder_days != null ? String(editing.reminder_days) : "",
      is_auto_pay: editing?.is_auto_pay ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: BillFormData) => {
      const body = JSON.stringify({
        ...data,
        is_auto_pay: isAutoPay,
        // In edit mode a cleared optional must be an explicit null:
        // undefined is dropped by JSON.stringify and the backend's
        // exclude_unset update would silently keep the old value.
        day_of_month: data.day_of_month
          ? parseInt(data.day_of_month)
          : editing
            ? null
            : undefined,
        // reminder_days is NOT NULL (default 3) on the backend, so clearing
        // it resets to the default rather than sending null.
        reminder_days: data.reminder_days
          ? parseInt(data.reminder_days)
          : editing
            ? 3
            : undefined,
      });
      return editing
        ? apiFetch(`/api/bills/${editing.id}`, { method: "PUT", body })
        : apiFetch("/api/bills", { method: "POST", body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!editing) {
        reset();
        setIsAutoPay(false);
      }
      setOpen(false);
      onSaved?.();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save bill");
    },
  });

  function onSubmit(data: BillFormData) {
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
            Add Bill
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit bill" : "Add Bill"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Bill Name</Label>
            <Input
              id="name"
              placeholder="e.g. Netflix"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={watch("frequency")}
              onValueChange={(value) => setValue("frequency", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {/* Only frequencies the backend accepts: weekly|monthly|yearly */}
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            {errors.frequency && (
              <p className="text-sm text-destructive">
                {errors.frequency.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="next_due_date">Next due date</Label>
            <Input
              id="next_due_date"
              type="date"
              {...register("next_due_date")}
            />
            {errors.next_due_date && (
              <p className="text-sm text-destructive">
                {errors.next_due_date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="day_of_month">Day of Month</Label>
            <Input
              id="day_of_month"
              type="number"
              min="1"
              max="31"
              placeholder="1-31"
              {...register("day_of_month")}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto_pay">Auto-pay</Label>
            <Switch
              id="auto_pay"
              checked={isAutoPay}
              onCheckedChange={setIsAutoPay}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminder_days">Reminder (days before)</Label>
            <Input
              id="reminder_days"
              type="number"
              min="0"
              placeholder="3"
              {...register("reminder_days")}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {editing
              ? mutation.isPending
                ? "Saving..."
                : "Save"
              : mutation.isPending
                ? "Creating..."
                : "Add Bill"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
