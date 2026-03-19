"use client";

import {
  AlertTriangle,
  AlertCircle,
  Receipt,
  PiggyBank,
  Bell,
} from "lucide-react";
import { formatRelativeDate, cn } from "@/lib/utils";

interface NotificationItemProps {
  id: string;
  type: string;
  message: string;
  created_at: string;
  is_read: boolean;
  onMarkRead: (id: string) => void;
}

function getIcon(type: string) {
  switch (type) {
    case "budget_80":
      return <PiggyBank className="h-5 w-5 text-yellow-500" />;
    case "budget_100":
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case "bill_reminder":
      return <Receipt className="h-5 w-5 text-blue-500" />;
    case "bill_overdue":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

export function NotificationItem({
  id,
  type,
  message,
  created_at,
  is_read,
  onMarkRead,
}: NotificationItemProps) {
  return (
    <button
      className={cn(
        "flex items-start gap-3 w-full text-left p-4 rounded-lg transition-colors",
        is_read
          ? "bg-background hover:bg-accent/50"
          : "bg-accent/30 hover:bg-accent/50"
      )}
      onClick={() => {
        if (!is_read) onMarkRead(id);
      }}
    >
      <div className="mt-0.5">{getIcon(type)}</div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", !is_read && "font-medium")}>{message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeDate(created_at)}
        </p>
      </div>
      {!is_read && (
        <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
      )}
    </button>
  );
}
