"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Genel bakış" },
  { href: "/admin/ustalar", label: "Ustalar" },
  { href: "/admin/site", label: "Site" },
] as const;

export function AdminHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2">
        <div className="flex h-11 items-center gap-2">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
            U
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">UstaPlan</span>
          <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Yönetim</span>
        </div>
        <div className="flex items-center gap-1 sm:order-last">
          <Link
            href="/admin/sifre"
            aria-label="Şifre"
            className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-ink"
          >
            <KeyRound className="size-4" aria-hidden />
            <span className="hidden sm:inline">Şifre</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Çıkış yap"
              className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Çıkış yap</span>
            </button>
          </form>
        </div>
        <div className="w-full sm:w-auto sm:flex-1">{children}</div>
      </div>
    </header>
  );
}

/** Tab links; `pathname` null renders them without an active tab (Suspense fallback). */
export function AdminNavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Yönetim menüsü">
      <ul className="flex gap-1">
        {TABS.map(({ href, label }) => {
          const active =
            pathname !== null && (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-xl px-3 text-sm font-semibold",
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-ink",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminNav() {
  return <AdminNavBar pathname={usePathname()} />;
}
