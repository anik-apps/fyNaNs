"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const TIME_RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
];

interface TransactionFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  accountId: string;
  onAccountChange: (value: string) => void;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
}

export function TransactionFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  accountId,
  onAccountChange,
  timeRange,
  onTimeRangeChange,
  categories,
  accounts,
}: TransactionFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountId} onValueChange={onAccountChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((acct) => (
              <SelectItem key={acct.id} value={acct.id}>
                {acct.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Calendar className="w-4 h-4 text-muted-foreground self-center mr-1 flex-shrink-0" />
        {TIME_RANGES.map((range) => (
          <Button
            key={range.value}
            variant={timeRange === range.value ? "default" : "outline"}
            size="sm"
            className={cn("text-xs h-7 px-2.5 flex-shrink-0")}
            onClick={() => onTimeRangeChange(range.value)}
          >
            {range.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
