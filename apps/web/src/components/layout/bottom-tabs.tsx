"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  PiggyBank,
  Ellipsis,
  Receipt,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useState, useRef, useEffect } from "react";

const tabItems = [
  { href: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.ACCOUNTS, label: "Accounts", icon: Landmark },
  { href: ROUTES.TRANSACTIONS, label: "Transactions", icon: ArrowLeftRight },
  { href: ROUTES.BUDGETS, label: "Budgets", icon: PiggyBank },
];

const moreItems = [
  { href: ROUTES.BILLS, label: "Bills", icon: Receipt },
  { href: ROUTES.SETTINGS, label: "Settings", icon: Settings },
];

export function BottomTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isMoreActive = moreItems.some(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {/* More menu */}
        <div ref={moreRef} className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors",
              isMoreActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Ellipsis className="h-5 w-5" />
            <span>More</span>
          </button>
          {moreOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-40 rounded-md border bg-card shadow-lg py-1">
              {moreItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "text-primary bg-accent"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
