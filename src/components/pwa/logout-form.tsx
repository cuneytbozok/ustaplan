"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/actions/auth";

async function currentSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Çıkış yap: sends this device's push endpoint along so the server removes
 * it before signing out, and drops the browser-side subscription, so a shared
 * phone never gets the previous artisan's pushes.
 */
export function LogoutForm({ className, children }: { className?: string; children: React.ReactNode }) {
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    currentSubscription()
      .then((subscription) => setEndpoint(subscription?.endpoint ?? ""))
      .catch(() => setEndpoint(""));
  }, []);

  return (
    <form
      action={signOut}
      onSubmit={() => {
        currentSubscription()
          .then((subscription) => subscription?.unsubscribe())
          .catch(() => undefined);
      }}
    >
      <input type="hidden" name="pushEndpoint" value={endpoint} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
