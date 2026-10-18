"use client";

import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";
import { LogoutForm } from "@/components/pwa/logout-form";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Profile sheet from the header: Ayarlar and Çıkış (spec §2). */
export function ProfileMenu({ displayName, email }: { displayName: string; email: string }) {
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Profil menüsü"
        className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-ink hover:bg-muted"
      >
        <UserRound className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold text-ink">{displayName}</SheetTitle>
          <SheetDescription>{email}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <SheetClose asChild>
            <Link
              href="/ayarlar"
              className="flex h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 text-base font-medium text-ink hover:bg-muted"
            >
              <Settings className="size-5 text-muted-foreground" aria-hidden />
              Ayarlar
            </Link>
          </SheetClose>
          <LogoutForm className="flex h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 text-base font-medium text-ink hover:bg-muted">
              <LogOut className="size-5 text-muted-foreground" aria-hidden />
              Çıkış yap
          </LogoutForm>
        </div>
      </SheetContent>
    </Sheet>
  );
}
