"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Smartphone, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";

// --- Change Password ---
const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

// --- Set Password (OAuth users) ---
const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

interface Session {
  id: string;
  device_info: string;
  created_at: string;
  is_current: boolean;
}

interface MfaSetupResponse {
  qr_code_url: string;
  secret: string;
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [mfaSetup, setMfaSetup] = useState<MfaSetupResponse | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);

  // Check if user has a password (for OAuth users)
  useEffect(() => {
    async function checkPassword() {
      try {
        const data = await apiFetch<{ has_password: boolean }>(
          "/api/user/profile"
        );
        setHasPassword(data.has_password);
      } catch {
        // assume has password
      }
    }
    checkPassword();
  }, []);

  // Load active sessions
  useEffect(() => {
    async function fetchSessions() {
      try {
        const data = await apiFetch<{ items: Session[] }>(
          "/api/auth/sessions"
        );
        setSessions(data.items);
      } catch {
        // handled
      } finally {
        setIsLoadingSessions(false);
      }
    }
    fetchSessions();
  }, []);

  // --- Change Password Form ---
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  async function onChangePassword(data: PasswordFormData) {
    setPwError(null);
    setPwSuccess(false);
    try {
      await apiFetch("/api/auth/password/change", {
        method: "PUT",
        body: JSON.stringify({
          current_password: data.current_password,
          new_password: data.new_password,
        }),
      });
      setPwSuccess(true);
      passwordForm.reset();
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  // --- Set Password Form (OAuth users) ---
  const setPasswordForm = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
  });
  const [spError, setSpError] = useState<string | null>(null);
  const [spSuccess, setSpSuccess] = useState(false);

  async function onSetPassword(data: SetPasswordFormData) {
    setSpError(null);
    setSpSuccess(false);
    try {
      await apiFetch("/api/auth/password/set", {
        method: "POST",
        body: JSON.stringify({ password: data.password }),
      });
      setSpSuccess(true);
      setHasPassword(true);
      setPasswordForm.reset();
    } catch (err) {
      setSpError(err instanceof Error ? err.message : "Failed to set password");
    }
  }

  // --- MFA Setup ---
  async function handleSetupMfa() {
    try {
      const data = await apiFetch<MfaSetupResponse>("/api/auth/mfa/setup", {
        method: "POST",
      });
      setMfaSetup(data);
      setMfaError(null);
      setMfaSuccess(false);
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Failed to setup MFA");
    }
  }

  async function handleVerifyMfa() {
    try {
      await apiFetch("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: mfaCode }),
      });
      setMfaSuccess(true);
      setMfaSetup(null);
      setMfaCode("");
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Invalid code");
    }
  }

  // --- Revoke Session ---
  async function handleRevokeSession(sessionId: string) {
    try {
      await apiFetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // handled
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Security</h1>

      {/* Change Password or Set Password */}
      {hasPassword ? (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit(onChangePassword)}
              className="space-y-4"
            >
              {pwError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md">
                  Password changed successfully
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type="password"
                  {...passwordForm.register("current_password")}
                />
                {passwordForm.formState.errors.current_password && (
                  <p className="text-sm text-destructive">
                    {passwordForm.formState.errors.current_password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  {...passwordForm.register("new_password")}
                />
                {passwordForm.formState.errors.new_password && (
                  <p className="text-sm text-destructive">
                    {passwordForm.formState.errors.new_password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  {...passwordForm.register("confirm_password")}
                />
                {passwordForm.formState.errors.confirm_password && (
                  <p className="text-sm text-destructive">
                    {passwordForm.formState.errors.confirm_password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={passwordForm.formState.isSubmitting}
              >
                {passwordForm.formState.isSubmitting
                  ? "Changing..."
                  : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Set Password</CardTitle>
            <CardDescription>
              You signed up with OAuth. Set a password to also log in with
              email and password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={setPasswordForm.handleSubmit(onSetPassword)}
              className="space-y-4"
            >
              {spError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {spError}
                </div>
              )}
              {spSuccess && (
                <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md">
                  Password set successfully
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="sp_password">Password</Label>
                <Input
                  id="sp_password"
                  type="password"
                  {...setPasswordForm.register("password")}
                />
                {setPasswordForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {setPasswordForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp_confirm">Confirm Password</Label>
                <Input
                  id="sp_confirm"
                  type="password"
                  {...setPasswordForm.register("confirm_password")}
                />
                {setPasswordForm.formState.errors.confirm_password && (
                  <p className="text-sm text-destructive">
                    {setPasswordForm.formState.errors.confirm_password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={setPasswordForm.formState.isSubmitting}
              >
                {setPasswordForm.formState.isSubmitting
                  ? "Setting..."
                  : "Set Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            {user?.has_mfa
              ? "Two-factor authentication is enabled"
              : "Add an extra layer of security to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaSuccess && (
            <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md">
              2FA enabled successfully
            </div>
          )}
          {mfaError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {mfaError}
            </div>
          )}

          {!mfaSetup && !user?.has_mfa && (
            <Button onClick={handleSetupMfa}>Enable 2FA</Button>
          )}

          {user?.has_mfa && !mfaSetup && (
            <Badge variant="secondary">Enabled</Badge>
          )}

          {mfaSetup && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan the QR code with your authenticator app, then enter the
                6-digit code to verify.
              </p>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mfaSetup.qr_code_url}
                  alt="MFA QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center font-mono">
                {mfaSetup.secret}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 6-digit code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  maxLength={6}
                />
                <Button onClick={handleVerifyMfa} disabled={mfaCode.length !== 6}>
                  Verify
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSessions ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {session.device_info}
                      {session.is_current && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Current
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {formatDate(session.created_at)}
                    </p>
                  </div>
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
