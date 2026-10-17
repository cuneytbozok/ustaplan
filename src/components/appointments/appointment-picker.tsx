"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { checkSchedule, type ScheduleCheck } from "@/actions/appointments";
import { inputClassName } from "@/components/common/form-field";
import { DURATION_CHIPS, istanbulDateKey, istanbulDateTime, istanbulTimeKey, MAX_DURATION_MINUTES, MIN_DURATION_MINUTES, STEP_MINUTES, TIME_OPTIONS } from "@/lib/domain/scheduling";
import { formatDate, formatShortDate, formatTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export type PickerValue = { date: string; time: string; duration: number };

const chipClass = "flex h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors";
const chip = (active: boolean) => cn(chipClass, active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-ink hover:bg-muted");
const OTHER_DURATIONS = Array.from({ length: (MAX_DURATION_MINUTES - MIN_DURATION_MINUTES) / STEP_MINUTES + 1 }, (_, i) => MIN_DURATION_MINUTES + i * STEP_MINUTES);

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h} sa ${m} dk` : h ? `${h} saat` : `${m} dk`;
}

/**
 * Date chips (Bugün / Yarın / Tarih seç), 15-minute time, duration chips.
 * Submits apptDate, apptTime, apptDuration; the server converts them in Istanbul time.
 * Clashes are shown with a suggested slot, but saving is never blocked (plan §8).
 */
export function AppointmentPicker({
  today,
  tomorrow,
  initial,
  excludeId,
  onConflictChange,
}: {
  today: string;
  tomorrow: string;
  initial: PickerValue;
  excludeId?: string;
  onConflictChange?: (hasConflict: boolean) => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(initial.duration);
  const [pickDate, setPickDate] = useState(initial.date !== today && initial.date !== tomorrow);
  const [otherDuration, setOtherDuration] = useState(!(DURATION_CHIPS as readonly number[]).includes(initial.duration));
  const [check, setCheck] = useState<ScheduleCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const request = useRef(0);
  const notify = useRef(onConflictChange);
  useEffect(() => {
    notify.current = onConflictChange;
  });

  useEffect(() => {
    const start = istanbulDateTime(date, time);
    const id = ++request.current;
    const timer = setTimeout(async () => {
      if (!start) {
        setCheck(null);
        notify.current?.(false);
        return;
      }
      const end = new Date(start.getTime() + duration * 60_000);
      const result = await checkSchedule({ start: start.toISOString(), end: end.toISOString(), excludeId });
      if (id !== request.current) return; // a newer choice is being checked
      setCheck(result.ok ? result.data : null);
      setCheckError(result.ok ? null : result.error);
      notify.current?.(result.ok && result.data.conflicts.length > 0);
    }, 250);
    return () => clearTimeout(timer);
  }, [date, time, duration, excludeId]);

  const conflicts = check?.conflicts ?? [];
  const suggestion = check?.suggestion;

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="apptDate" value={date} />
      <input type="hidden" name="apptDuration" value={duration} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Tarih</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!pickDate && date === today} onClick={() => { setPickDate(false); setDate(today); }} className={chip(!pickDate && date === today)}>
            Bugün
          </button>
          <button type="button" aria-pressed={!pickDate && date === tomorrow} onClick={() => { setPickDate(false); setDate(tomorrow); }} className={chip(!pickDate && date === tomorrow)}>
            Yarın
          </button>
          <button type="button" aria-pressed={pickDate} onClick={() => setPickDate(true)} className={cn(chip(pickDate), "gap-1.5")}>
            <CalendarDays className="size-4" aria-hidden />
            Tarih seç
          </button>
        </div>
        {pickDate ? (
          <input
            type="date"
            aria-label="Randevu tarihi"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className={inputClassName}
          />
        ) : null}
        {date ? <p className="text-xs text-muted-foreground">{formatDate(istanbulDateTime(date, "12:00") ?? new Date(0))}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="apptTime" className="text-sm font-medium text-ink">
          Saat
        </label>
        <select id="apptTime" name="apptTime" value={time} onChange={(event) => setTime(event.target.value)} className={inputClassName}>
          {TIME_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Süre</legend>
        <div className="flex flex-wrap gap-2">
          {DURATION_CHIPS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={!otherDuration && duration === minutes}
              onClick={() => { setOtherDuration(false); setDuration(minutes); }}
              className={chip(!otherDuration && duration === minutes)}
            >
              {durationLabel(minutes)}
            </button>
          ))}
          <button type="button" aria-pressed={otherDuration} onClick={() => setOtherDuration(true)} className={chip(otherDuration)}>
            Diğer
          </button>
        </div>
        {otherDuration ? (
          <select aria-label="Süre" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={inputClassName}>
            {OTHER_DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {durationLabel(minutes)}
              </option>
            ))}
          </select>
        ) : null}
      </fieldset>

      {conflicts.length ? (
        <div role="status" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-ink">
          <p className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Bu saatte başka randevun var
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {conflicts.map((c) => (
              <li key={c.id} className="break-words">
                {c.jobTitle} · {formatShortDate(c.starts_at)} {formatTime(c.starts_at)}–{formatTime(c.ends_at)}
              </li>
            ))}
          </ul>
          {suggestion ? (
            <button
              type="button"
              onClick={() => {
                const start = new Date(suggestion.start);
                const key = istanbulDateKey(start);
                setPickDate(key !== today && key !== tomorrow);
                setDate(key);
                setTime(istanbulTimeKey(start));
              }}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              Boş saat: {formatShortDate(suggestion.start)} {formatTime(suggestion.start)}–{formatTime(suggestion.end)}
            </button>
          ) : (
            <p className="mt-2 text-muted-foreground">Bu gün ve ertesi gün için boş saat bulunamadı.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">İstersen yine de bu saate kaydedebilirsin.</p>
        </div>
      ) : null}
      {checkError ? <p className="text-xs text-muted-foreground">Çakışma kontrol edilemedi: {checkError}</p> : null}
    </div>
  );
}
