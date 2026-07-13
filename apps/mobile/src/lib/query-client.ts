import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

/**
 * App-wide QueryClient. Lives in its own module so non-React code (e.g. the
 * auth provider) can clear the cache on logout/login, preventing one user's
 * cached financial data from leaking into another session.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Client errors (4xx) won't succeed on retry; don't hammer the API.
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }
        // A single retry keeps pull-to-refresh snappy on 5xx instead of
        // hanging through several backoff rounds.
        return failureCount < 1;
      },
    },
  },
});
