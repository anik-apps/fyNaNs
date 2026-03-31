"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useRef, useState } from "react";

export function OAuthButtons() {
  const { loginWithOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      setError(null);
      try {
        await loginWithOAuth("google", response.credential);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google login failed");
      }
    },
    [loginWithOAuth],
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    function initGoogle() {
      const google = (window as unknown as { google?: { accounts: { id: {
        initialize: (config: Record<string, unknown>) => void;
        renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
      } } } }).google;
      if (!google || !googleBtnRef.current) return;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
      });

      google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: googleBtnRef.current.offsetWidth,
      });

      setSdkReady(true);
    }

    // Load SDK if not already loaded
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [handleCredential]);

  return (
    <div className="space-y-2">
      {!sdkReady && (
        <Button variant="outline" className="w-full" disabled>
          Loading...
        </Button>
      )}
      <div
        ref={googleBtnRef}
        className={`w-full ${sdkReady ? "" : "hidden"}`}
      />
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
