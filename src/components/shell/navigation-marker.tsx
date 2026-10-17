"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const IN_APP_NAVIGATION_KEY = "ustaplan:navigated";

/** Remembers (per tab) that the user moved between app pages, so "Geri" can use history. */
export function NavigationMarker() {
  const pathname = usePathname();
  const first = useRef(pathname);
  useEffect(() => {
    if (pathname === first.current) return;
    try {
      sessionStorage.setItem(IN_APP_NAVIGATION_KEY, "1");
    } catch {
      // Storage blocked: "Geri" falls back to the parent page.
    }
  }, [pathname]);
  return null;
}

export function canGoBack() {
  try {
    return window.history.length > 1 && sessionStorage.getItem(IN_APP_NAVIGATION_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Back to wherever the user came from inside the app; a page opened directly
 * (link, notification, new tab) has no in-app history and goes to `fallback`.
 */
export function useGoBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
