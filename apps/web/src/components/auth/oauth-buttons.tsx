"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export function OAuthButtons() {
  const { loginWithOAuth } = useAuth();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setIsLoading("google");
    setError(null);
    try {
      const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        setError("Google login is not configured");
        return;
      }

      const google = (window as unknown as Record<string, unknown>).google as
        | {
            accounts: {
              id: {
                initialize: (config: {
                  client_id: string;
                  callback: (response: { credential: string }) => void;
                }) => void;
                prompt: () => void;
              };
            };
          }
        | undefined;
      if (!google) {
        setError("Google SDK failed to load. Please refresh and try again.");
        return;
      }

      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential: string }) => {
          await loginWithOAuth("google", response.credential);
        },
      });
      google.accounts.id.prompt();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Google login failed");
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleLogin}
        disabled={isLoading !== null}
      >
        {isLoading === "google" ? "Connecting..." : "Continue with Google"}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        disabled={isLoading !== null}
        onClick={() => {
          // TODO: implement Apple Sign In
          setError("Apple Sign In is not yet available.");
        }}
      >
        {isLoading === "apple" ? "Connecting..." : "Continue with Apple"}
      </Button>
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
