"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";

interface NotificationSettings {
  bill_reminders: boolean;
  budget_alerts: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    bill_reminders: true,
    budget_alerts: true,
    email_notifications: true,
    push_notifications: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await apiFetch<NotificationSettings>("/api/user/settings");
        setSettings(data);
      } catch {
        // use defaults
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setSuccess(false);
    try {
      await apiFetch("/api/user/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSuccess(true);
    } catch {
      // handled
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notification Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {success && (
            <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md">
              Settings saved
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>Bill Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get notified before bills are due
              </p>
            </div>
            <Switch
              checked={settings.bill_reminders}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, bill_reminders: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Budget Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Alerts when approaching or exceeding budget limits
              </p>
            </div>
            <Switch
              checked={settings.budget_alerts}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, budget_alerts: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={settings.email_notifications}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, email_notifications: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications in your browser
              </p>
            </div>
            <Switch
              checked={settings.push_notifications}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, push_notifications: checked }))
              }
            />
          </div>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
