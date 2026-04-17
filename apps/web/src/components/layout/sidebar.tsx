"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  PiggyBank,
  Target,
  Receipt,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

const navItems = [
  { href: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.ACCOUNTS, label: "Accounts", icon: Landmark },
  { href: ROUTES.TRANSACTIONS, label: "Transactions", icon: ArrowLeftRight },
  { href: ROUTES.BUDGETS, label: "Budgets", icon: PiggyBank },
  { href: ROUTES.GOALS, label: "Savings Goals", icon: Target },
  { href: ROUTES.BILLS, label: "Bills", icon: Receipt },
  { href: ROUTES.SETTINGS, label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 border-r bg-card h-screen sticky top-0">
      <div className="p-6">
        <Link href={ROUTES.DASHBOARD} className="flex items-center gap-3">
          <img src="/logo-40.png" alt="fyNaNs" width={40} height={40} className="rounded-lg" />
          <span className="text-2xl font-bold">
            fy<span className="text-muted-foreground">NaN</span>s
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
