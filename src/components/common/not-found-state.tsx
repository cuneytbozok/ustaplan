import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "./empty-state";

/**
 * "Not found" UI. Pages render it inline from inside their <Suspense> instead of
 * calling notFound(): with Cache Components a notFound() thrown after streaming
 * starts left the skeleton on screen (Next 16.4, seen in M1.6).
 */
export function NotFoundState({ backHref = "/bugun", backLabel = "Bugün'e dön" }: { backHref?: string; backLabel?: string }) {
  return (
    <EmptyState icon={SearchX} title="Bulunamadı" description="Aradığın kayıt yok ya da silinmiş.">
      <Link
        href={backHref}
        className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-muted"
      >
        {backLabel}
      </Link>
    </EmptyState>
  );
}
