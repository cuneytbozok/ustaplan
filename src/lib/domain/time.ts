import { TZDate } from "@date-fns/tz";
import { addDays, startOfDay, startOfISOWeek } from "date-fns";

// All business time is Europe/Istanbul; the DB stores UTC timestamptz.
export const TIME_ZONE = "Europe/Istanbul";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, day: "numeric", month: "long", weekday: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

/** "17 Ekim Cumartesi" */
export function formatDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

/** "17 Eki" */
export function formatShortDate(value: Date | string) {
  return shortDateFormatter.format(new Date(value));
}

/** "14:30" */
export function formatTime(value: Date | string) {
  return timeFormatter.format(new Date(value));
}

/** UTC bounds [start, end) of the Istanbul calendar day containing `now`. */
export function istanbulDayRange(now: Date = new Date()) {
  const start = startOfDay(new TZDate(now, TIME_ZONE));
  return { start: new Date(start.getTime()), end: new Date(addDays(start, 1).getTime()) };
}

/** UTC bounds [start, end) of the Istanbul ISO week (Monday start) containing `now`. */
export function istanbulWeekRange(now: Date = new Date()) {
  const start = startOfISOWeek(new TZDate(now, TIME_ZONE));
  return { start: new Date(start.getTime()), end: new Date(addDays(start, 7).getTime()) };
}

/** True while a visit hasn't ended yet ("future" in J4/J6, plan T-12). */
export function hasNotEnded(endsAt: Date | string, now: Date = new Date()) {
  return new Date(endsAt).getTime() > now.getTime();
}
