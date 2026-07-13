"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create the client inside useState so it isn't shared across SSR requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // Never retry client errors (4xx), except transient ones:
              // 408 Request Timeout and 429 Too Many Requests.
              if (
                error instanceof ApiError &&
                error.status >= 400 &&
                error.status < 500 &&
                error.status !== 408 &&
                error.status !== 429
              ) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
