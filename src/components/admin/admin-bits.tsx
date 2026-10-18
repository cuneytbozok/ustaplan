import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatShortDate, formatTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

/** Account status with colour and text. */
export function ArtisanStatus({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold",
        active ? "bg-primary-soft text-primary" : "bg-danger/10 text-danger",
      )}
    >
      {active ? "Aktif" : "Devre dışı"}
    </span>
  );
}

/** "17 Eki 14:30", or the fallback when there's no value. */
export function formatMoment(value: string | null, fallback = "—") {
  return value ? `${formatShortDate(value)} ${formatTime(value)}` : fallback;
}

export function AdminBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:text-ink">
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
