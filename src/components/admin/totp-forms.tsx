"use client";

import { useActionState, useState, useTransition } from "react";
import { startTotpEnrollment, verifyTotp, type TotpEnrollment } from "@/actions/admin-mfa";

/** First admin sign-in: register an authenticator app, then confirm one code. */
export function TotpEnroll() {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink">İki adımlı doğrulama</h2>
          <p className="text-sm text-muted-foreground">
            Yönetim paneli şifrenin yanında doğrulama uygulamasından (Google Authenticator, Microsoft Authenticator vb.) bir kod
            ister. Bir kez kurman yeterli.
          </p>
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await startTotpEnrollment();
              if (result.ok) setEnrollment(result.data);
              else setError(result.error);
            })
          }
          className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          {pending ? "Hazırlanıyor…" : "Doğrulama uygulamasını kur"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink">Kodu tara</h2>
        <p className="text-sm text-muted-foreground">Uygulamada yeni hesap ekle ve bu kodu tara. Sonra uygulamanın gösterdiği 6 haneli kodu gir.</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL from Supabase, nothing to optimise */}
      <img src={enrollment.qrCode} alt="Doğrulama uygulaması için QR kodu" className="mx-auto size-48 rounded-xl border border-border bg-white p-2" />
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer py-2 font-medium text-ink">Tarayamıyor musun? Anahtarı elle gir</summary>
        <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all text-ink">{enrollment.secret}</code>
      </details>
      <CodeForm factorId={enrollment.factorId} submitLabel="Doğrula ve bitir" />
    </div>
  );
}

/** Later sign-ins: one code from the registered app. */
export function TotpVerify() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink">Doğrulama kodu</h2>
        <p className="text-sm text-muted-foreground">Doğrulama uygulamandaki UstaPlan kodunu gir.</p>
      </div>
      <CodeForm submitLabel="Devam et" />
    </div>
  );
}

function CodeForm({ factorId, submitLabel }: { factorId?: string; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(verifyTotp, null);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {factorId ? <input type="hidden" name="factorId" value={factorId} /> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium text-ink">
          6 haneli kod
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          className="h-12 rounded-xl border border-border bg-surface px-3 text-center font-mono text-xl tracking-[0.4em] text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? "Doğrulanıyor…" : submitLabel}
      </button>
    </form>
  );
}
