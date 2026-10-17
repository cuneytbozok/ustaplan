"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Hammer, PackageSearch, RotateCcw, XCircle } from "lucide-react";
import { changeJobStatus, type StatusAction } from "@/actions/jobs";
import { inputClassName } from "@/components/common/form-field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDate, formatTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

type Appointment = { id: string; starts_at: string; ends_at: string };

const rowClass =
  "flex h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 text-base font-medium text-ink hover:bg-muted disabled:opacity-60";
const primaryClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70";

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/** Reopen a completed or cancelled job (J5): one tap, no appointment is created. */
export function ReopenJobButton({ jobId }: { jobId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await changeJobStatus(jobId, "reopen");
            setError(result.ok ? null : result.error);
          })
        }
        className={primaryClass}
      >
        <RotateCcw className="size-5" aria-hidden />
        {pending ? "Açılıyor…" : "İşi yeniden aç"}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/** Manual status changes for an open job (J1, J4, J6). The sheet closes only after the server confirmed. */
export function JobStatusSheet({ jobId, status, upcoming }: { jobId: string; status: string; upcoming: Appointment[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "complete" | "cancel">("menu");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: StatusAction) {
    setError(null);
    startTransition(async () => {
      const result = await changeJobStatus(jobId, action, action === "cancel" ? note : "");
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  const upcomingList = upcoming.length ? (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-ink">
      <p className="font-medium">Bu randevular iptal edilecek:</p>
      <ul className="mt-1 list-disc pl-5">
        {upcoming.map((a) => (
          <li key={a.id}>
            {formatDate(a.starts_at)}, {formatTime(a.starts_at)}–{formatTime(a.ends_at)}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setStep("menu");
          setNote("");
          setError(null);
        }
      }}
    >
      <SheetTrigger className={primaryClass}>Durumu değiştir</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold text-ink">
            {step === "complete" ? "İş tamamlansın mı?" : step === "cancel" ? "İş iptal edilsin mi?" : "Durumu değiştir"}
          </SheetTitle>
          <SheetDescription>
            {step === "menu"
              ? "Planlandı ve Planlanacak durumları randevulara göre kendiliğinden değişir."
              : step === "complete"
                ? "İş Tamamlananlar listesine geçer. Gerekirse yeniden açabilirsin."
                : "Müşteriye otomatik mesaj gitmez. Gerekirse yeniden açabilirsin."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4">
          {step === "menu" ? (
            <>
              <button type="button" disabled={pending || status === "in_progress"} onClick={() => run("start")} className={rowClass}>
                <Hammer className="size-5 text-muted-foreground" aria-hidden />
                Devam ediyor
                {status === "in_progress" ? <span className="ml-auto text-xs text-muted-foreground">Şu anki durum</span> : null}
              </button>
              <button
                type="button"
                disabled={pending || status === "waiting_material"}
                onClick={() => run("wait_material")}
                className={rowClass}
              >
                <PackageSearch className="size-5 text-muted-foreground" aria-hidden />
                Parça bekleniyor
                {status === "waiting_material" ? <span className="ml-auto text-xs text-muted-foreground">Şu anki durum</span> : null}
              </button>
              <button type="button" disabled={pending} onClick={() => setStep("complete")} className={rowClass}>
                <CheckCircle2 className="size-5 text-primary" aria-hidden />
                Tamamlandı
              </button>
              <button type="button" disabled={pending} onClick={() => setStep("cancel")} className={cn(rowClass, "text-danger")}>
                <XCircle className="size-5" aria-hidden />
                İptal et
              </button>
            </>
          ) : step === "complete" ? (
            <>
              {upcomingList}
              <button type="button" disabled={pending} onClick={() => run("complete")} className={primaryClass}>
                <CheckCircle2 className="size-5" aria-hidden />
                {pending ? "Kaydediliyor…" : "Evet, tamamlandı"}
              </button>
            </>
          ) : (
            <>
              {upcomingList}
              <label htmlFor="cancelNote" className="text-sm font-medium text-ink">
                Not (isteğe bağlı)
              </label>
              <textarea
                id="cancelNote"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-describedby="cancelNote-hint"
                className={cn(inputClassName, "h-auto py-2.5")}
              />
              <p id="cancelNote-hint" className="text-xs text-muted-foreground">
                Sadece sen görürsün.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => run("cancel")}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger text-base font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
              >
                <XCircle className="size-5" aria-hidden />
                {pending ? "Kaydediliyor…" : "Evet, iptal et"}
              </button>
            </>
          )}
          {step !== "menu" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setStep("menu");
                setError(null);
              }}
              className="h-11 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Vazgeç
            </button>
          ) : null}
          <ErrorLine error={error} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
