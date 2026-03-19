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
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  institution_name: z.string().min(1, "Institution is required"),
  type: z.string().min(1, "Account type is required"),
  balance: z.string().min(1, "Balance is required"),
  currency: z.string().default("USD"),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AddAccountDialogProps {
  onAccountAdded?: () => void;
}

export function AddAccountDialog({ onAccountAdded }: AddAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { currency: "USD" },
  });

  async function onSubmit(data: AccountFormData) {
    setError(null);
    try {
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          balance: data.balance,
          is_manual: true,
        }),
      });
      reset();
      setOpen(false);
      onAccountAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Manual Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              placeholder="e.g. Main Checking"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="institution_name">Institution</Label>
            <Input
              id="institution_name"
              placeholder="e.g. Chase"
              {...register("institution_name")}
            />
            {errors.institution_name && (
              <p className="text-sm text-destructive">
                {errors.institution_name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select onValueChange={(value) => setValue("type", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="mortgage">Mortgage</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">
                {errors.type.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="balance">Current Balance</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("balance")}
            />
            {errors.balance && (
              <p className="text-sm text-destructive">
                {errors.balance.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Add Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
