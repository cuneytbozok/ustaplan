"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { inputClassName } from "@/components/common/form-field";
import { INVALID_LINK_MESSAGE } from "@/components/public/invalid-link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CANCEL_REASON_LABELS, type CancelReason } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

const REASONS = Object.entries(CANCEL_REASON_LABELS) as [CancelReason, string][];

const dangerClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger text-base font-semibold text-white hover:bg-danger/90 disabled:opacity-70";

/** Shown right above the action button, so it stays in view on small phones. */
function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/**
 * Customer cancel flow (spec §5.3, siz tone): a required reason, a note that is
 * required for "Diğer", then a clear last confirmation. The sheet closes and
 * the page refreshes only after the server confirmed the cancellation.
 */
export function CancelSheet({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const noteRequired = reason === "other";

  function next() {
    if (!reason) return setError("Lütfen bir iptal sebebi seçin.");
    if (noteRequired && !note.trim()) return setError("Lütfen kısa bir açıklama yazın.");
    setError(null);
    setStep("confirm");
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/t/${token}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, note }),
        });
        if (response.status === 404) return setError(INVALID_LINK_MESSAGE);
        const result = (await response.json()) as { ok: boolean; error?: string };
        if (!result.ok) return setError(result.error ?? "İptal kaydedilemedi. Lütfen tekrar deneyin.");
        setOpen(false);
        router.refresh();
      } catch {
        setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setStep("form");
          setReason(null);
          setNote("");
          setError(null);
        }
      }}
    >
      <SheetTrigger className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-medium text-danger hover:bg-muted">
        <XCircle className="size-5" aria-hidden />
        İşi iptal et
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold text-ink">
            {step === "form" ? "İşi iptal et" : "İşi iptal etmek istediğinize emin misiniz?"}
          </SheetTitle>
          <SheetDescription>
            {step === "form"
              ? "İptal sebebini seçin. Ustanız bilgilendirilir."
              : "Planlı randevunuz da iptal edilir ve ustanız bilgilendirilir. Bu işlem bu bağlantıdan geri alınamaz."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4">
          {step === "form" ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-ink">İptal sebebi</legend>
                {REASONS.map(([code, label]) => (
                  <label
                    key={code}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 text-base text-ink",
                      reason === code ? "border-primary bg-primary-soft" : "border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value={code}
                      checked={reason === code}
                      onChange={() => setReason(code)}
                      className="size-5 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label htmlFor="cancelNote" className="mt-2 text-sm font-medium text-ink">
                {noteRequired ? "Açıklama (zorunlu)" : "Açıklama (isteğe bağlı)"}
              </label>
              <textarea
                id="cancelNote"
                rows={2}
                maxLength={500}
                value={note}
                required={noteRequired}
                aria-invalid={noteRequired && error !== null && !note.trim() ? true : undefined}
                onChange={(event) => setNote(event.target.value)}
                aria-describedby="cancelNote-hint"
                className={cn(inputClassName, "h-auto py-2.5")}
              />
              <p id="cancelNote-hint" className="text-xs text-muted-foreground">
                Ustanız görür.
              </p>
              <ErrorLine error={error} />
              <button type="button" onClick={next} className={cn(dangerClass, "mt-2")}>
                Devam
              </button>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-ink">
                <p>
                  <span className="text-muted-foreground">Sebep: </span>
                  {reason ? CANCEL_REASON_LABELS[reason] : null}
                </p>
                {note.trim() ? <p className="mt-1 break-words whitespace-pre-line">{note.trim()}</p> : null}
              </div>
              <ErrorLine error={error} />
              <button type="button" disabled={pending} onClick={submit} className={dangerClass}>
                <XCircle className="size-5" aria-hidden />
                {pending ? "İptal ediliyor…" : "Evet, işi iptal et"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setStep("form");
                  setError(null);
                }}
                className="h-11 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Vazgeç
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
