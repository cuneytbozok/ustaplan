"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, MessageSquareText } from "lucide-react";
import { checkSchedule, respondToRequest, type ScheduleCheck } from "@/actions/appointments";
import { ConfirmAction } from "@/components/common/confirm-action";
import { FormStatus } from "@/components/common/form-status";
import type { ActionResult } from "@/lib/action-result";
import { istanbulDateKey, istanbulTimeKey } from "@/lib/domain/scheduling";
import { formatDate, formatShortDate, formatTime } from "@/lib/domain/time";
import { AppointmentPicker } from "./appointment-picker";

export type OpenRequest = {
  id: string;
  status: string;
  requested_starts_at: string;
  requested_ends_at: string;
  counter_starts_at: string | null;
  counter_ends_at: string | null;
  request_note: string | null;
  appointment: { id: string; starts_at: string; ends_at: string };
  /** Shown on Bugün, where the card isn't inside its job. */
  job?: { id: string; title: string; customerName: string };
};

const range = (start: string, end: string) => `${formatDate(start)}, ${formatTime(start)}–${formatTime(end)}`;
const primaryClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70";
const secondaryClass =
  "flex h-11 w-full items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted disabled:opacity-60";

function CounterForm({ request, today, tomorrow, onDone }: { request: OpenRequest; today: string; tomorrow: string; onDone: () => void }) {
  const [conflict, setConflict] = useState(false);
  const [state, formAction, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    const result = await respondToRequest(request.id, "counter", formData);
    if (result.ok) onDone();
    return result;
  }, null);
  const base = request.counter_starts_at ?? request.requested_starts_at;
  const initial = {
    date: istanbulDateKey(new Date(base)),
    time: istanbulTimeKey(new Date(base)),
    duration: Math.round((Date.parse(request.appointment.ends_at) - Date.parse(request.appointment.starts_at)) / 60_000),
  };

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <p className="text-sm font-semibold text-ink">Başka tarih öner</p>
      <AppointmentPicker today={today} tomorrow={tomorrow} initial={initial} excludeId={request.appointment.id} onConflictChange={setConflict} />
      {state && !state.ok ? <FormStatus state={state} success="" /> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} disabled={pending} className={secondaryClass}>
          Vazgeç
        </button>
        <button type="submit" disabled={pending} className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          {pending ? "Gönderiliyor…" : conflict ? "Yine de öner" : "Müşteriye öner"}
        </button>
      </div>
    </form>
  );
}

/**
 * A customer's date request (plan §8): approve (atomic swap), reject, or
 * counter with the picker and its conflict card. The current visit stays as
 * it is until the swap. Nothing changes on screen before the server confirmed.
 */
export function RequestCard({ request, today, tomorrow }: { request: OpenRequest; today: string; tomorrow: string }) {
  const [countering, setCountering] = useState(false);
  const [check, setCheck] = useState<ScheduleCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const waitingForCustomer = request.status === "pending_customer";

  // Conflicts at the requested time; approving is never blocked by them.
  useEffect(() => {
    if (waitingForCustomer) return;
    let current = true;
    checkSchedule({ start: request.requested_starts_at, end: request.requested_ends_at, excludeId: request.appointment.id }).then((result) => {
      if (current && result.ok) setCheck(result.data);
    });
    return () => {
      current = false;
    };
  }, [waitingForCustomer, request.requested_starts_at, request.requested_ends_at, request.appointment.id]);
  // Only relevant while the artisan still has to decide on the requested time.
  const conflicts = waitingForCustomer ? [] : (check?.conflicts ?? []);

  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-warning">
        <MessageSquareText className="size-4 shrink-0" aria-hidden />
        {waitingForCustomer ? "Müşterinin yanıtı bekleniyor" : "Müşteri yeni tarih istedi"}
      </p>
      {request.job ? (
        <Link href={`/isler/${request.job.id}`} className="mt-1 block truncate text-base font-semibold text-ink hover:underline">
          {request.job.customerName} · {request.job.title}
        </Link>
      ) : null}

      <dl className="mt-2 flex flex-col gap-1 text-sm">
        <div>
          <dt className="inline text-muted-foreground">Şu anki randevu: </dt>
          <dd className="inline text-ink">{range(request.appointment.starts_at, request.appointment.ends_at)}</dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">İstenen: </dt>
          <dd className="inline font-semibold text-ink">{range(request.requested_starts_at, request.requested_ends_at)}</dd>
        </div>
        {waitingForCustomer && request.counter_starts_at && request.counter_ends_at ? (
          <div>
            <dt className="inline text-muted-foreground">Senin önerin: </dt>
            <dd className="inline font-semibold text-ink">{range(request.counter_starts_at, request.counter_ends_at)}</dd>
          </div>
        ) : null}
      </dl>
      {request.request_note ? <p className="mt-2 rounded-xl bg-surface px-3 py-2 text-sm break-words whitespace-pre-line text-ink">{request.request_note}</p> : null}

      {conflicts.length ? (
        <div role="status" className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-ink">
          <p className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            İstenen saatte başka randevun var
          </p>
          <ul className="mt-1">
            {conflicts.map((c) => (
              <li key={c.id} className="break-words">
                {c.jobTitle} · {formatShortDate(c.starts_at)} {formatTime(c.starts_at)}–{formatTime(c.ends_at)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {countering ? (
          <CounterForm request={request} today={today} tomorrow={tomorrow} onDone={() => setCountering(false)} />
        ) : (
          <>
            {!waitingForCustomer ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await respondToRequest(request.id, "approve");
                    setError(result.ok ? null : result.error);
                  })
                }
                className={primaryClass}
              >
                <Check className="size-5" aria-hidden />
                {pending ? "Kaydediliyor…" : conflicts.length ? "Yine de onayla" : "Onayla"}
              </button>
            ) : null}
            <button type="button" disabled={pending} onClick={() => setCountering(true)} className={secondaryClass}>
              {waitingForCustomer ? "Önerini değiştir" : "Başka tarih öner"}
            </button>
            {!waitingForCustomer ? (
              <ConfirmAction
                action={() => respondToRequest(request.id, "reject")}
                label="Reddet"
                confirmLabel="Reddet"
                pendingLabel="Kaydediliyor…"
                question="Talep reddedilsin mi? Randevu aynı kalır, müşteri bağlantıda görür."
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
