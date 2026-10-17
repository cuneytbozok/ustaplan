"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/bugun", label: "Bugün", icon: Sun },
  { href: "/takvim", label: "Takvim", icon: CalendarDays },
  { href: "/isler", label: "İşler", icon: ClipboardList },
  { href: "/musteriler", label: "Müşteriler", icon: Users },
] as const;

/** Tab bar markup; `pathname` null renders it without an active tab (Suspense fallback). */
export function BottomNavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Ana menü"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                  active ? "text-primary" : "text-muted-foreground hover:text-ink",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Active-tab aware nav. usePathname is request-time data, so render it inside <Suspense>. */
export function BottomNav() {
  return <BottomNavBar pathname={usePathname()} />;
}
