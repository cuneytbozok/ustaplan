import { Suspense } from "react";
import { getCurrentArtisan } from "@/lib/auth";
import { InboxBell } from "./inbox-bell";
import { ProfileMenu } from "./profile-menu";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
            U
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">UstaPlan</span>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={<div className="size-11 rounded-xl border border-border bg-surface" aria-hidden />}>
            <InboxBell />
          </Suspense>
          <Suspense fallback={<div className="size-11 rounded-xl border border-border bg-surface" aria-hidden />}>
            <HeaderProfile />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderProfile() {
  const artisan = await getCurrentArtisan();
  return <ProfileMenu displayName={artisan.displayName} email={artisan.email} />;
}
