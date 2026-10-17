"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

const TAB_ROOTS = ["/bugun", "/takvim", "/isler", "/musteriler"];

/** "+ Yeni iş" on every tab (not on forms or detail pages). Render inside <Suspense>: it reads the URL. */
export function NewJobFab() {
  const pathname = usePathname();
  if (!TAB_ROOTS.includes(pathname)) return null;
  return (
    <Link
      href="/isler/yeni"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-[0_8px_20px_rgb(25_116_90/0.25)] hover:bg-primary/90 sm:right-[calc(50%-17rem)]"
    >
      <Plus className="size-5" aria-hidden />
      Yeni iş
    </Link>
  );
}
