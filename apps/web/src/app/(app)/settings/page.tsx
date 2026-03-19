"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Shield, Bell, Download, Trash2 } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";

const settingsLinks = [
  {
    href: ROUTES.SETTINGS_PROFILE,
    label: "Profile",
    description: "Update your name and avatar",
    icon: User,
  },
  {
    href: ROUTES.SETTINGS_SECURITY,
    label: "Security",
    description: "Password, 2FA, and active sessions",
    icon: Shield,
  },
  {
    href: ROUTES.SETTINGS_NOTIFICATIONS,
    label: "Notifications",
    description: "Email and push notification preferences",
    icon: Bell,
  },
];

export default function SettingsPage() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      await apiFetch("/api/user/export", { method: "POST" });
    } catch {
      // handled
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await apiFetch("/api/user/account", { method: "DELETE" });
      window.location.href = "/login";
    } catch {
      // handled
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="grid gap-4">
        {settingsLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 pt-6">
                <link.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{link.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-3 pt-4 border-t">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exporting..." : "Export Data"}
        </Button>

        <div>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data
              including accounts, transactions, budgets, and bills will be
              permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
