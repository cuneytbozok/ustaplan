"use client";

import { useEffect } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Android/Chromium offers a one-time install prompt early, before Ayarlar may
// be open. It is kept here so the install guide can show a real button.
let deferredPrompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();

export function getInstallPrompt() {
  return deferredPrompt;
}

export function onInstallPromptChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearInstallPrompt() {
  deferredPrompt = null;
  listeners.forEach((listener) => listener());
}

/**
 * Registers /sw.js (production only: a worker in `next dev` would get in the
 * way of hot reload) and captures the install prompt. Renders nothing.
 */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // No worker means no offline page and no push; the app itself still works.
      });
    }
    const capture = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as InstallPrompt;
      listeners.forEach((listener) => listener());
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  return null;
}
