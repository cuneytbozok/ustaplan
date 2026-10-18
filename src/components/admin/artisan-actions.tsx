"use client";

import { useState, useTransition } from "react";
import { resetArtisanPassword, setArtisanActive } from "@/actions/admin";
import { ConfirmAction } from "@/components/common/confirm-action";
import { TemporaryPassword } from "./temporary-password";

export function ResetPasswordAction({ userId, name }: { userId: string; name: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  if (password) return <TemporaryPassword password={password} />;

  return (
    <div className="flex flex-col gap-3">
      {asking ? (
        <div role="alertdialog" aria-label="Şifre sıfırlansın mı?" className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-sm text-ink">{name} için yeni bir geçici şifre oluşturulsun mu? Eski şifresi çalışmaz.</p>
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
                  const result = await resetArtisanPassword(userId);
                  setAsking(false);
                  if (result.ok) setPassword(result.data.password);
                  else setError(result.error);
                })
              }
              className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
            >
              {pending ? "Sıfırlanıyor…" : "Şifreyi sıfırla"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAsking(true);
          }}
          className="h-11 w-fit rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-muted"
        >
          Geçici şifre oluştur
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

export function ActiveAction({ userId, name, active }: { userId: string; name: string; active: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (active) {
    return (
      <ConfirmAction
        action={() => setArtisanActive(userId, false)}
        label="Devre dışı bırak"
        confirmLabel="Devre dışı bırak"
        pendingLabel="Kaydediliyor…"
        question={`${name} giriş yapamayacak ve bildirim almayacak. Açık oturumu en geç 1 saat içinde kapanır. Verileri ve müşteri bağlantıları olduğu gibi kalır.`}
        className="w-full sm:w-80"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await setArtisanActive(userId, true);
            if (!result.ok) setError(result.error);
          })
        }
        className="h-11 w-fit rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? "Kaydediliyor…" : "Yeniden etkinleştir"}
      </button>
      <p className="text-xs text-muted-foreground">Usta yeniden giriş yapabilir; bildirimleri her cihazda tekrar açması gerekir.</p>
      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
