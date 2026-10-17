"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarClock, Check, Plus } from "lucide-react";
import { closeAppointment, saveAppointment } from "@/actions/appointments";
import { ConfirmAction } from "@/components/common/confirm-action";
import { FormStatus } from "@/components/common/form-status";
import type { ActionResult } from "@/lib/action-result";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/domain/labels";
import { istanbulDateKey, istanbulTimeKey } from "@/lib/domain/scheduling";
import { formatDate, formatTime } from "@/lib/domain/time";
import { AppointmentPicker, type PickerValue } from "./appointment-picker";

export type AppointmentItem = { id: string; starts_at: string; ends_at: string; status: string; overdue: boolean };
type PickerDefaults = { today: string; tomorrow: string; initial: PickerValue };

const range = (a: { starts_at: string; ends_at: string }) => `${formatDate(a.starts_at)}, ${formatTime(a.starts_at)}–${formatTime(a.ends_at)}`;

function AppointmentForm({
  jobId,
  appointment,
  picker,
  onDone,
}: {
  jobId: string;
  appointment?: AppointmentItem;
  picker: PickerDefaults;
  onDone: () => void;
}) {
  const [conflict, setConflict] = useState(false);
  const [state, formAction, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    const result = await saveAppointment(jobId, appointment?.id ?? null, formData);
    if (result.ok) onDone();
    return result;
  }, null);
  const initial = appointment
    ? {
        date: istanbulDateKey(new Date(appointment.starts_at)),
        time: istanbulTimeKey(new Date(appointment.starts_at)),
        duration: Math.round((Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000),
      }
    : picker.initial;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <p className="text-sm font-semibold text-ink">{appointment ? "Yeniden planla" : "Yeni randevu"}</p>
      <AppointmentPicker today={picker.today} tomorrow={picker.tomorrow} initial={initial} excludeId={appointment?.id} onConflictChange={setConflict} />
      {state && !state.ok ? <FormStatus state={state} success="" /> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} disabled={pending} className="h-12 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted">
          Vazgeç
        </button>
        <button type="submit" disabled={pending} className="h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          {pending ? "Kaydediliyor…" : conflict ? "Yine de kaydet" : "Randevuyu kaydet"}
        </button>
      </div>
    </form>
  );
}

function CompleteVisitButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await closeAppointment(id, "completed");
            setError(result.ok ? null : result.error);
          })
        }
        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
      >
        <Check className="size-4 text-primary" aria-hidden />
        {pending ? "Kaydediliyor…" : "Ziyaret yapıldı"}
      </button>
      {error ? (
        <p role="alert" className="col-span-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Visits of one job (J2/J3): add, reschedule, mark done, cancel. Closed jobs are read-only. */
export function AppointmentsSection({
  jobId,
  isOpen,
  appointments,
  picker,
}: {
  jobId: string;
  isOpen: boolean;
  appointments: AppointmentItem[];
  picker: PickerDefaults;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const scheduled = appointments.filter((a) => a.status === "scheduled");
  const closed = appointments.filter((a) => a.status !== "scheduled" && a.status !== "superseded");
  const close = () => setEditing(null);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-base font-semibold text-ink">Randevular</h2>

      {scheduled.length === 0 && editing !== "new" ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {isOpen ? "Planlı randevu yok." : "Planlı randevu yok. Yeniden açınca randevu ekleyebilirsin."}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {scheduled.map((a) =>
          editing === a.id ? (
            <li key={a.id}>
              <AppointmentForm jobId={jobId} appointment={a} picker={picker} onDone={close} />
            </li>
          ) : (
            <li key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="min-w-0 flex-1 text-sm font-medium text-ink">{range(a)}</p>
                {a.overdue ? (
                  <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-warning/12 px-2.5 text-xs font-semibold text-warning">Gecikti</span>
                ) : null}
              </div>
              {isOpen ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <CompleteVisitButton id={a.id} />
                    <button
                      type="button"
                      onClick={() => setEditing(a.id)}
                      className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted"
                    >
                      Yeniden planla
                    </button>
                  </div>
                  <ConfirmAction
                    className="mt-1"
                    action={() => closeAppointment(a.id, "cancelled")}
                    label="Randevuyu iptal et"
                    confirmLabel="İptal et"
                    pendingLabel="Kaydediliyor…"
                    question="Bu randevu iptal edilsin mi? Müşteriye otomatik mesaj gitmez."
                  />
                </>
              ) : null}
            </li>
          ),
        )}
      </ul>

      {isOpen ? (
        editing === "new" ? (
          <div className="mt-3">
            <AppointmentForm jobId={jobId} picker={picker} onDone={close} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-ink hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
            Randevu ekle
          </button>
        )
      ) : null}

      {closed.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-medium text-ink">Geçmiş ziyaretler</h3>
          <ul className="mt-1 flex flex-col divide-y divide-border">
            {closed.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">{range(a)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
