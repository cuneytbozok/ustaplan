"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/**
 * Two-step destructive button: first tap asks, second tap runs the action.
 * Shows the server's error if the action refuses (e.g. customer has jobs).
 */
export function ConfirmAction({
  action,
  label,
  confirmLabel,
  question,
  pendingLabel = "Siliniyor…",
  className,
}: {
  action: () => Promise<ActionResult | void>;
  label: string;
  confirmLabel: string;
  question: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAsking(true);
          }}
          className="flex h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-danger hover:bg-danger/10"
        >
          {label}
        </button>
        {error ? (
          <p role="alert" className="mt-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div role="alertdialog" aria-label={question} className={cn("rounded-xl border border-danger/30 bg-danger/5 p-3", className)}>
      <p className="text-sm text-ink">{question}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={pending}
          className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await action();
              if (result && !result.ok) {
                setError(result.error);
                setAsking(false);
              }
            })
          }
          className="h-11 rounded-xl bg-danger text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  );
}
