"use client";

import { RotateCw, TriangleAlert } from "lucide-react";

/** Error with a retry action; used by error boundaries and failed loads. */
export function ErrorState({
  title = "Bir sorun oluştu",
  description = "Bilgiler yüklenemedi. Bağlantını kontrol edip tekrar dene.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-danger/30 bg-surface px-5 py-10 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <TriangleAlert className="size-6" aria-hidden />
      </div>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-muted"
      >
        <RotateCw className="size-4" aria-hidden />
        Tekrar dene
      </button>
    </div>
  );
}
