"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { changeJobStatus } from "@/actions/jobs";

/** Takip gerekenler: complete a job that has no upcoming visit, after one confirmation. */
export function CompleteJobQuick({ jobId }: { jobId: string }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const base = "flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-60";

  if (!asking) {
    return (
      <>
        <button type="button" onClick={() => { setError(null); setAsking(true); }} className={`${base} border border-border bg-surface text-ink hover:bg-muted`}>
          <CheckCircle2 className="size-4 text-primary" aria-hidden />
          Tamamlandı
        </button>
        {error ? (
          <p role="alert" className="col-span-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </>
    );
  }
  return (
    <div role="alertdialog" aria-label="İş tamamlansın mı?" className="col-span-2 rounded-xl border border-border bg-muted p-3">
      <p className="text-sm text-ink">İş tamamlansın mı? Gerekirse yeniden açabilirsin.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" disabled={pending} onClick={() => setAsking(false)} className={`${base} border border-border bg-surface text-ink hover:bg-surface/80`}>
          Vazgeç
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await changeJobStatus(jobId, "complete");
              if (!result.ok) {
                setError(result.error);
                setAsking(false);
              }
            })
          }
          className={`${base} bg-primary font-semibold text-primary-foreground hover:bg-primary/90`}
        >
          {pending ? "Kaydediliyor…" : "Evet, tamamlandı"}
        </button>
      </div>
    </div>
  );
}
