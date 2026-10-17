import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:text-ink"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
