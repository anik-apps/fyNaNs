"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

function useGoogleSdk() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
}

export function OAuthButtons() {
  const { loginWithOAuth } = useAuth();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const googleSdkLoaded = useGoogleSdk();

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
          try {
            await loginWithOAuth("google", response.credential);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google login failed");
          } finally {
            setIsLoading(null);
          }
        },
      });
      google.accounts.id.prompt();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Google login failed");
      setIsLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleLogin}
        disabled={isLoading !== null || !googleSdkLoaded}
      >
        {isLoading === "google" ? "Connecting..." : !googleSdkLoaded ? "Loading..." : "Continue with Google"}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        disabled
      >
        Continue with Apple{" "}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          Coming Soon
        </span>
      </Button>
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
