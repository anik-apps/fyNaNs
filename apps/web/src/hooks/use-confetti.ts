"use client";

import confetti from "canvas-confetti";
import { useCallback } from "react";

declare global {
  interface Window {
    __FYNANS_E2E?: boolean;
  }
}

/**
 * Fires a celebratory confetti burst. Suppressed under Playwright
 * (set `window.__FYNANS_E2E = true` via `page.addInitScript`).
 */
export function useConfetti() {
  return useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.__FYNANS_E2E) return;
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }, []);
}
