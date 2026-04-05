"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { ACCOUNT_TYPE_CONFIG } from "@/lib/account-type-config";

interface AccountCardProps {
  id: string;
  name: string;
  type: string;
  balance: string;
  institution_name: string;
  last_synced: string | null;
}


export function AccountCard({
  id,
  name,
  type,
  balance,
  institution_name,
  last_synced,
}: AccountCardProps) {
  const config = ACCOUNT_TYPE_CONFIG[type] || { label: type, icon: Building2, color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30" };
  const Icon = config.icon;
  const isLiability = type === "credit" || type === "loan";

  return (
    <Link
      href={`/accounts/${id}`}
      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {institution_name}
          {last_synced && (
            <span className="ml-2">
              · Synced{" "}
              {new Date(last_synced).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isLiability ? "text-red-600 dark:text-red-400" : ""}`}>
          {formatCurrency(balance)}
        </p>
        <Badge variant="secondary" className="text-[10px] mt-0.5">
          {config.label}
        </Badge>
      </div>
    </Link>
  );
}
