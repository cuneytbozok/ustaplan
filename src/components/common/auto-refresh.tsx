"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 30_000;
// Resume and the interval can coincide; never refresh more often than this.
const MIN_GAP_MS = 5_000;

// Focus on these doesn't mean the user is typing.
const NOT_TYPING = new Set(["radio", "checkbox", "button", "submit", "reset", "file", "range", "color", "hidden"]);

/** True while the user is in the middle of something a re-render could disturb. */
function busy() {
  // A closing sheet stays in the DOM with data-state="closed" until its exit animation ends.
  if (document.querySelector('[role="dialog"]:not([data-state="closed"]), [role="alertdialog"]:not([data-state="closed"])')) return true;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active.closest('[data-state="closed"]')) return false;
  if (active instanceof HTMLInputElement) return !NOT_TYPING.has(active.type);
  return active.isContentEditable || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
}

/**
 * Keeps server data fresh without a reload button (plan T-14): re-renders the
 * current route when the page becomes visible again and every 30 s while it
 * is visible. Skipped while a sheet is open or a field has focus. Client state
 * (open forms, typed text) survives router.refresh().
 */
export function AutoRefresh() {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    // Start the clock at mount: the page was just rendered with fresh data.
    last.current = performance.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || busy()) return;
      const now = performance.now();
      if (now - last.current < MIN_GAP_MS) return;
      last.current = now;
      router.refresh();
    };
    const timer = window.setInterval(refresh, INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}
