"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export function OAuthButtons() {
  const { loginWithOAuth } = useAuth();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setIsLoading("google");
    try {
      const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        console.error("Google client ID not configured");
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
        console.error("Google SDK not loaded");
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
      console.error("Google login failed:", error);
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
          console.log("Apple Sign In not yet configured");
        }}
      >
        {isLoading === "apple" ? "Connecting..." : "Continue with Apple"}
      </Button>
    </div>
  );
}
