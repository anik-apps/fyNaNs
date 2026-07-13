import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Refetch a query whenever the screen regains focus, skipping the initial
 * mount (useQuery already fetches then), so opening a screen issues a single
 * request instead of two.
 *
 * Standard TanStack Query React Native recipe.
 */
export function useRefreshOnFocus<T>(refetch: () => Promise<T>) {
  const firstTimeRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false;
        return;
      }
      refetch();
    }, [refetch])
  );
}
