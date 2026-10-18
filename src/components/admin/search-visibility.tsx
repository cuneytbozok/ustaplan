"use client";

import { useState, useTransition } from "react";
import { setSearchVisibility } from "@/actions/admin";

/** Open / hide the landing page for search engines, with a confirmation step. */
export function SearchVisibilityAction({ visible }: { visible: boolean }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const next = !visible;

  return (
    <div className="flex flex-col gap-3">
      {asking ? (
        <div role="alertdialog" aria-label="Görünürlük değişsin mi?" className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-sm text-ink">
            {next ? "Ana sayfa arama motorlarına açılsın mı?" : "Ana sayfa arama motorlarından gizlensin mi? Önceden listelenmişse kaybolması zaman alabilir."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setAsking(false)}
              className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await setSearchVisibility(next);
                  setAsking(false);
                  if (!result.ok) setError(result.error);
                })
              }
              className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
            >
              {pending ? "Kaydediliyor…" : next ? "Görünür yap" : "Gizle"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className={
            next
              ? "h-11 w-fit rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              : "h-11 w-fit rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-muted"
          }
        >
          {next ? "Arama motorlarına aç" : "Arama motorlarından gizle"}
        </button>
      )}
      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
