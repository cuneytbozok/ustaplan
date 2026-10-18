"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

/** A just-generated temporary password: shown once, never stored by the app. */
export function TemporaryPassword({ password, email }: { password: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="rounded-2xl border border-primary/30 bg-primary-soft p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <KeyRound className="size-4" aria-hidden />
        Geçici şifre
      </p>
      {email ? <p className="mt-1 text-sm text-ink">{email}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-surface px-3 py-2.5 font-mono text-base break-all text-ink">{password}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              .writeText(password)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-muted"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Bu şifre bir daha gösterilmez. Ustaya özelden ilet; usta giriş yaptıktan sonra Ayarlar&apos;dan değiştirebilir.
      </p>
    </div>
  );
}
