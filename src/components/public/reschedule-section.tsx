"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check } from "lucide-react";
import { inputClassName } from "@/components/common/form-field";
import { INVALID_LINK_MESSAGE } from "@/components/public/invalid-link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CustomerRequest } from "@/lib/public-job";
import { istanbulDateKey, istanbulTimeKey, TIME_OPTIONS } from "@/lib/domain/scheduling";
import { formatDate, formatTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

type Appointment = { startsAt: string; endsAt: string };

const secondaryClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-medium text-ink hover:bg-muted disabled:opacity-60";
const primaryClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70";

const when = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/** JSON call to the customer API; null on success, otherwise a siz-tone message. */
async function send(url: string, method: "POST" | "DELETE", body: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.status === 404) return INVALID_LINK_MESSAGE;
    const result = (await response.json()) as { ok: boolean; error?: string };
    return result.ok ? null : (result.error ?? "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
  } catch {
    return "Bağlantı kurulamadı. Lütfen tekrar deneyin.";
  }
}

/** Sheet to ask for a new time for the next appointment. Same duration; no availability is shown. */
function RequestSheet({
  token,
  appointment,
  today,
  open,
  onOpenChange,
}: {
  token: string;
  appointment: Appointment;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const tomorrow = istanbulDateKey(new Date(`${today}T12:00:00Z`), 1);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState(istanbulTimeKey(new Date(appointment.startsAt)));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const minutes = Math.round((Date.parse(appointment.endsAt) - Date.parse(appointment.startsAt)) / 60_000);

  function submit() {
    setError(null);
    startTransition(async () => {
      const failure = await send(`/api/t/${token}/reschedule`, "POST", { date, time, note });
      if (failure) return setError(failure);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        onOpenChange(value);
        if (value) {
          setError(null);
          setNote("");
        }
      }}
    >
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold text-ink">Yeni tarih isteyin</SheetTitle>
          <SheetDescription>
            Şu anki randevunuz: {when(appointment.startsAt)}. Ustanız onaylayana kadar bu randevu geçerlidir.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rescheduleDate" className="text-sm font-medium text-ink">
              Tarih
            </label>
            <input
              id="rescheduleDate"
              type="date"
              min={today}
              value={date}
              onChange={(event) => event.target.value && setDate(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rescheduleTime" className="text-sm font-medium text-ink">
              Saat
            </label>
            <select id="rescheduleTime" value={time} onChange={(event) => setTime(event.target.value)} className={inputClassName}>
              {TIME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Süre aynı kalır ({minutes} dakika).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rescheduleNote" className="text-sm font-medium text-ink">
              Not (isteğe bağlı)
            </label>
            <textarea
              id="rescheduleNote"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={cn(inputClassName, "h-auto py-2.5")}
            />
            <p className="text-xs text-muted-foreground">Ustanız görür.</p>
          </div>
          <ErrorLine error={error} />
          <button type="button" disabled={pending} onClick={submit} className={primaryClass}>
            {pending ? "Gönderiliyor…" : "İsteği gönder"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Date change on the customer page (spec §5.2, plan §8, siz tone): ask for a
 * new time for the next appointment, see the open request or the artisan's
 * counter-offer, accept it or withdraw. Every change waits for the server.
 */
export function RescheduleSection({
  token,
  appointment,
  request,
  canRequest,
  today,
}: {
  token: string;
  appointment: Appointment;
  request: CustomerRequest | null;
  canRequest: boolean;
  today: string;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!canRequest) return null;

  const open = request && request.status !== "rejected" ? request : null;

  function run(url: string, method: "POST" | "DELETE") {
    if (!open) return;
    setError(null);
    startTransition(async () => {
      const failure = await send(url, method, { requestId: open.id });
      if (failure) return setError(failure);
      setConfirmWithdraw(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      {request?.status === "rejected" ? (
        <p className="text-sm text-ink">Ustanız istediğiniz {when(request.requestedStartsAt)} saatine uygun değil. Randevunuz aynı kaldı.</p>
      ) : null}

      {open?.status === "pending_artisan" ? (
        <p role="status" className="rounded-xl bg-warning/10 px-3 py-2.5 text-sm text-ink">
          {when(open.requestedStartsAt)} için isteğiniz ustanıza iletildi. Yanıt bekleniyor.
        </p>
      ) : null}

      {open?.status === "pending_customer" && open.counterStartsAt && open.counterEndsAt ? (
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-3">
          <p className="text-sm text-ink">Ustanız yeni bir saat önerdi:</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {formatDate(open.counterStartsAt)}, {formatTime(open.counterStartsAt)}–{formatTime(open.counterEndsAt)}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(`/api/t/${token}/reschedule/accept`, "POST")}
            className={cn(primaryClass, "mt-3")}
          >
            <Check className="size-5" aria-hidden />
            {pending ? "Kaydediliyor…" : "Bu saati kabul et"}
          </button>
        </div>
      ) : null}

      <ErrorLine error={error} />

      <button type="button" disabled={pending} onClick={() => setSheetOpen(true)} className={secondaryClass}>
        <CalendarClock className="size-5" aria-hidden />
        {open || request?.status === "rejected" ? "Başka bir tarih iste" : "Tarih değişikliği iste"}
      </button>

      {open ? (
        confirmWithdraw ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => setConfirmWithdraw(false)} className={secondaryClass}>
              Vazgeç
            </button>
            <button type="button" disabled={pending} onClick={() => run(`/api/t/${token}/reschedule`, "DELETE")} className={cn(secondaryClass, "text-danger")}>
              {pending ? "Kaydediliyor…" : "Evet, geri çek"}
            </button>
          </div>
        ) : (
          <button type="button" disabled={pending} onClick={() => setConfirmWithdraw(true)} className="h-11 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">
            İsteği geri çek
          </button>
        )
      ) : null}

      <RequestSheet token={token} appointment={appointment} today={today} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
