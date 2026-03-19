"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

declare global {
  interface Window {
    Plaid?: {
      create: (config: PlaidLinkConfig) => PlaidLinkHandler;
    };
  }
}

interface PlaidLinkConfig {
  token: string;
  onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
  onExit: (err: PlaidLinkError | null, metadata: PlaidLinkMetadata) => void;
  onEvent?: (eventName: string, metadata: PlaidLinkMetadata) => void;
}

interface PlaidLinkHandler {
  open: () => void;
  destroy: () => void;
}

interface PlaidLinkMetadata {
  institution?: {
    institution_id: string;
    name: string;
  };
  [key: string]: unknown;
}

interface PlaidLinkError {
  error_code: string;
  error_message: string;
  [key: string]: unknown;
}

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

function usePlaidScript(): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.Plaid) {
      setLoaded(true);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => console.error("Failed to load Plaid Link script");
    document.head.appendChild(script);

    return () => {
      // Don't remove the script on unmount -- other components may use it
    };
  }, []);

  return loaded;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const plaidReady = usePlaidScript();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (!window.Plaid) return;

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get a link token from our API
      const { link_token } = await apiFetch<{ link_token: string }>(
        "/api/plaid/link-token",
        { method: "POST" }
      );

      // Step 2: Open Plaid Link
      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (publicToken, metadata) => {
          try {
            // Step 3: Exchange the public token through our API
            await apiFetch("/api/plaid/exchange-token", {
              method: "POST",
              body: JSON.stringify({
                public_token: publicToken,
                institution_id: metadata.institution?.institution_id ?? "",
                institution_name: metadata.institution?.name ?? "",
              }),
            });
            onSuccess?.();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Failed to link account"
            );
          } finally {
            handler.destroy();
          }
        },
        onExit: (err) => {
          if (err) {
            setError(err.error_message || "Plaid Link closed unexpectedly");
          }
          setIsLoading(false);
          handler.destroy();
        },
        onEvent: (eventName) => {
          if (eventName === "OPEN") {
            setIsLoading(false);
          }
        },
      });

      handler.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Plaid Link");
      setIsLoading(false);
    }
  }, [onSuccess]);

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!plaidReady || isLoading}
      >
        <Landmark className="h-4 w-4 mr-2" />
        {isLoading ? "Connecting..." : "Link Bank"}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
