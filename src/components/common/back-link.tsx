"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { canGoBack, useGoBack } from "@/components/shell/navigation-marker";
import { cn } from "@/lib/utils";

/**
 * "Geri": returns to wherever the user came from inside the app (Takvim,
 * a customer, İşler…). Without in-app history it goes to `href`, the parent page.
 */
export function BackLink({ href, iconOnly = false, className }: { href: string; iconOnly?: boolean; className?: string }) {
  const goBack = useGoBack(href);
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || !canGoBack()) return;
        event.preventDefault();
        goBack();
      }}
      aria-label={iconOnly ? "Geri" : undefined}
      className={cn(
        "-ml-2 flex h-11 w-fit shrink-0 items-center gap-1 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-ink",
        iconOnly ? "w-11 justify-center" : "px-2",
        className,
      )}
    >
      <ChevronLeft className={iconOnly ? "size-6 text-ink" : "size-4"} aria-hidden />
      {iconOnly ? null : "Geri"}
    </Link>
  );
}
