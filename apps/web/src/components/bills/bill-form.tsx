"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

const billSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.string().min(1, "Amount is required"),
  frequency: z.string().min(1, "Frequency is required"),
  day_of_month: z.string().optional(),
  is_auto_pay: z.boolean().default(false),
  reminder_days: z.string().optional(),
});

type BillFormData = z.infer<typeof billSchema>;

interface BillFormProps {
  onBillCreated?: () => void;
}

export function BillForm({ onBillCreated }: BillFormProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutoPay, setIsAutoPay] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: { is_auto_pay: false },
  });

  async function onSubmit(data: BillFormData) {
    setError(null);
    try {
      await apiFetch("/api/bills", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          is_auto_pay: isAutoPay,
          day_of_month: data.day_of_month
            ? parseInt(data.day_of_month)
            : undefined,
          reminder_days: data.reminder_days
            ? parseInt(data.reminder_days)
            : undefined,
        }),
      });
      reset();
      setIsAutoPay(false);
      setOpen(false);
      onBillCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bill");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Bill
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Bill</DialogTitle>
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
              onValueChange={(value) => setValue("frequency", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Add Bill"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
