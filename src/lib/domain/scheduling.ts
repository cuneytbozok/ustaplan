import { TZDate } from "@date-fns/tz";
import { addDays, addMinutes, format } from "date-fns";
import { TIME_ZONE } from "./time";

// Scheduling rules (plan §8). Pure functions: the caller loads the artisan's
// scheduled appointments with an ordinary RLS select and passes them in.

export const DEFAULT_DURATION_MINUTES = 60;
export const DURATION_CHIPS = [30, 60, 90, 120] as const;
export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 480;
export const STEP_MINUTES = 15;

export type Interval = { start: Date; end: Date };
export type BusyAppointment = { id: string; starts_at: string; ends_at: string };

export function isValidDuration(minutes: number) {
  return Number.isInteger(minutes) && minutes >= MIN_DURATION_MINUTES && minutes <= MAX_DURATION_MINUTES && minutes % STEP_MINUTES === 0;
}

/** Half-open overlap: back-to-back visits (one ends when the next starts) don't clash. */
export function overlaps(a: Interval, b: Interval) {
  return a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();
}

/** Scheduled appointments that clash with the candidate, skipping the one being replaced. */
export function findConflicts<T extends BusyAppointment>(candidate: Interval, appointments: T[], excludeId?: string): T[] {
  return appointments.filter(
    (a) => a.id !== excludeId && overlaps(candidate, { start: new Date(a.starts_at), end: new Date(a.ends_at) }),
  );
}

/** "2026-10-19" + "14:30" in Istanbul → the UTC instant. Null for malformed input. */
export function istanbulDateTime(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!d || !t) return null;
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const value = new TZDate(year, month - 1, day, Number(t[1]), Number(t[2]), TIME_ZONE);
  // Reject dates that rolled over (e.g. 2026-02-30).
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return null;
  return new Date(value.getTime());
}

/** The Istanbul calendar date ("YYYY-MM-DD") of an instant; `offsetDays` gives Yarın etc. */
export function istanbulDateKey(instant: Date, offsetDays = 0) {
  return format(addDays(new TZDate(instant, TIME_ZONE), offsetDays), "yyyy-MM-dd");
}

/** The Istanbul wall-clock time ("HH:mm") of an instant, for prefilling the picker. */
export function istanbulTimeKey(instant: Date) {
  return format(new TZDate(instant, TIME_ZONE), "HH:mm");
}

function firstFreeSlot(dayKey: string, fromTime: string, untilTime: string, minutes: number, busy: Interval[], notBefore: Date) {
  const dayStart = istanbulDateTime(dayKey, fromTime);
  const dayEnd = istanbulDateTime(dayKey, untilTime);
  if (!dayStart || !dayEnd) return null;
  for (let start = dayStart; addMinutes(start, minutes) <= dayEnd; start = addMinutes(start, STEP_MINUTES)) {
    if (start < notBefore) continue;
    const slot = { start, end: addMinutes(start, minutes) };
    if (!busy.some((b) => overlaps(slot, b))) return slot;
  }
  return null;
}

/**
 * Suggested free slot of the same length (plan §8): the first gap on the
 * candidate's Istanbul day between 08:00 and 20:00, otherwise the next day
 * from 09:00 (until 20:00). Starts are on 15-minute steps and never in the
 * past. Null when neither day has room.
 */
export function suggestSlot(
  candidate: Interval,
  appointments: BusyAppointment[],
  options: { excludeId?: string; now?: Date } = {},
): Interval | null {
  const minutes = Math.round((candidate.end.getTime() - candidate.start.getTime()) / 60_000);
  if (minutes <= 0) return null;
  const now = options.now ?? new Date();
  const busy = appointments
    .filter((a) => a.id !== options.excludeId)
    .map((a) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) }));
  const day = istanbulDateKey(candidate.start);
  return (
    firstFreeSlot(day, "08:00", "20:00", minutes, busy, now) ??
    firstFreeSlot(istanbulDateKey(candidate.start, 1), "09:00", "20:00", minutes, busy, now)
  );
}

/** All picker times of a day in 15-minute steps: "00:00" … "23:45". */
export const TIME_OPTIONS = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, i) => {
  const minutes = i * STEP_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/**
 * Picker defaults: today and tomorrow (Istanbul) plus a starting slot,
 * the next full hour between 08:00 and 19:00, otherwise 09:00 the next working morning.
 */
export function pickerDefaults(now: Date = new Date()) {
  const today = istanbulDateKey(now);
  const tomorrow = istanbulDateKey(now, 1);
  const hour = new TZDate(now, TIME_ZONE).getHours() + 1;
  const start = hour < 8 ? { date: today, time: "09:00" } : hour > 19 ? { date: tomorrow, time: "09:00" } : { date: today, time: `${String(hour).padStart(2, "0")}:00` };
  return { today, tomorrow, ...start };
}

/** Reads the picker fields (Istanbul date + time + duration) of a form into a UTC interval. */
export function readAppointmentFields(formData: FormData): Interval | { error: string } {
  const start = istanbulDateTime(String(formData.get("apptDate") ?? ""), String(formData.get("apptTime") ?? ""));
  const duration = Number(formData.get("apptDuration"));
  if (!start) return { error: "Randevu için tarih ve saati seç." };
  if (!isValidDuration(duration)) return { error: "Süre 15 dakika ile 8 saat arasında olmalı." };
  return { start, end: addMinutes(start, duration) };
}
