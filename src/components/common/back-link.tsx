"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { canGoBack, useGoBack } from "@/components/shell/navigation-marker";

/**
 * "Geri": returns to wherever the user came from inside the app (Takvim,
 * a customer, İşler…). Without in-app history it goes to `href`, the parent page.
 */
export function BackLink({ href }: { href: string }) {
  const goBack = useGoBack(href);
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || !canGoBack()) return;
        event.preventDefault();
        goBack();
      }}
      className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:text-ink"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Geri
    </Link>
  );
}
