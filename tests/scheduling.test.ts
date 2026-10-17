import { describe, expect, it } from "vitest";
import {
  findConflicts,
  isValidDuration,
  istanbulDateKey,
  istanbulDateTime,
  istanbulTimeKey,
  overlaps,
  suggestSlot,
} from "@/lib/domain/scheduling";

const utc = (iso: string) => new Date(iso);
const at = (date: string, time: string) => istanbulDateTime(date, time)!;
const appt = (id: string, date: string, from: string, to: string) => ({
  id,
  starts_at: at(date, from).toISOString(),
  ends_at: at(date, to).toISOString(),
});
const slot = (date: string, from: string, to: string) => ({ start: at(date, from), end: at(date, to) });
// Long before the test days, so "not in the past" never interferes unless a test sets it.
const EARLY = utc("2026-01-01T00:00:00Z");

describe("overlaps (half-open)", () => {
  const a = { start: utc("2026-10-19T07:00:00Z"), end: utc("2026-10-19T08:00:00Z") };
  it("detects a real overlap", () => {
    expect(overlaps(a, { start: utc("2026-10-19T07:30:00Z"), end: utc("2026-10-19T08:30:00Z") })).toBe(true);
  });
  it("detects containment both ways", () => {
    expect(overlaps(a, { start: utc("2026-10-19T07:15:00Z"), end: utc("2026-10-19T07:45:00Z") })).toBe(true);
    expect(overlaps({ start: utc("2026-10-19T07:15:00Z"), end: utc("2026-10-19T07:45:00Z") }, a)).toBe(true);
  });
  it("treats back-to-back visits as free", () => {
    expect(overlaps(a, { start: utc("2026-10-19T08:00:00Z"), end: utc("2026-10-19T09:00:00Z") })).toBe(false);
    expect(overlaps(a, { start: utc("2026-10-19T06:00:00Z"), end: utc("2026-10-19T07:00:00Z") })).toBe(false);
  });
});

describe("findConflicts", () => {
  const list = [appt("x", "2026-10-19", "10:00", "11:00"), appt("y", "2026-10-19", "11:00", "12:00")];
  it("returns only the clashing appointments", () => {
    expect(findConflicts(slot("2026-10-19", "10:30", "11:00"), list).map((a) => a.id)).toEqual(["x"]);
    expect(findConflicts(slot("2026-10-19", "10:30", "11:30"), list).map((a) => a.id)).toEqual(["x", "y"]);
  });
  it("skips the appointment being replaced", () => {
    expect(findConflicts(slot("2026-10-19", "10:15", "11:00"), list, "x")).toEqual([]);
  });
});

describe("Istanbul ↔ UTC", () => {
  it("converts wall-clock time (UTC+3)", () => {
    expect(at("2026-10-19", "14:30").toISOString()).toBe("2026-10-19T11:30:00.000Z");
  });
  it("puts just-after-midnight Istanbul on the previous UTC day", () => {
    expect(at("2026-10-19", "00:30").toISOString()).toBe("2026-10-18T21:30:00.000Z");
    expect(istanbulDateKey(utc("2026-10-18T21:30:00Z"))).toBe("2026-10-19");
    expect(istanbulDateKey(utc("2026-10-18T20:59:00Z"))).toBe("2026-10-18");
    expect(istanbulTimeKey(utc("2026-10-18T21:30:00Z"))).toBe("00:30");
  });
  it("crosses month and year ends with offsets", () => {
    expect(istanbulDateKey(utc("2026-12-31T21:00:00Z"))).toBe("2027-01-01");
    expect(istanbulDateKey(utc("2026-10-31T12:00:00Z"), 1)).toBe("2026-11-01");
  });
  it("rejects malformed and impossible input", () => {
    expect(istanbulDateTime("2026-02-30", "10:00")).toBeNull();
    expect(istanbulDateTime("2026-10-19", "24:00")).toBeNull();
    expect(istanbulDateTime("19.10.2026", "10:00")).toBeNull();
    expect(istanbulDateTime("2026-10-19", "9:00")).toBeNull();
  });
});

describe("isValidDuration", () => {
  it("accepts 15–480 in 15-minute steps", () => {
    expect([15, 60, 480].every(isValidDuration)).toBe(true);
    expect([0, 10, 50, 495, 60.5].some(isValidDuration)).toBe(false);
  });
});

describe("suggestSlot", () => {
  const day = "2026-10-19";
  it("finds the first same-length gap between 08:00 and 20:00", () => {
    const busy = [appt("a", day, "08:00", "09:00"), appt("b", day, "09:30", "11:00")];
    // 60 minutes: 09:00–09:30 is too short, so 11:00.
    expect(suggestSlot(slot(day, "10:00", "11:00"), busy, { now: EARLY })).toEqual(slot(day, "11:00", "12:00"));
    // 30 minutes fits in the gap.
    expect(suggestSlot(slot(day, "10:00", "10:30"), busy, { now: EARLY })).toEqual(slot(day, "09:00", "09:30"));
  });
  it("starts at 08:00 on a free morning", () => {
    expect(suggestSlot(slot(day, "14:00", "15:30"), [appt("a", day, "14:00", "15:00")], { now: EARLY })).toEqual(
      slot(day, "08:00", "09:30"),
    );
  });
  it("ignores the appointment being replaced", () => {
    const busy = [appt("self", day, "08:00", "20:00")];
    expect(suggestSlot(slot(day, "10:00", "11:00"), busy, { excludeId: "self", now: EARLY })).toEqual(slot(day, "08:00", "09:00"));
  });
  it("must end by 20:00, otherwise the next day from 09:00", () => {
    const busy = [appt("a", day, "08:00", "19:30")];
    expect(suggestSlot(slot(day, "10:00", "11:00"), busy, { now: EARLY })).toEqual(slot("2026-10-20", "09:00", "10:00"));
  });
  it("skips busy time on the next day too", () => {
    const busy = [appt("a", day, "08:00", "20:00"), appt("b", "2026-10-20", "09:00", "10:15")];
    expect(suggestSlot(slot(day, "10:00", "11:00"), busy, { now: EARLY })).toEqual(slot("2026-10-20", "10:15", "11:15"));
  });
  it("never suggests the past and keeps 15-minute steps", () => {
    const now = at(day, "13:07");
    expect(suggestSlot(slot(day, "13:00", "14:00"), [appt("a", day, "13:00", "14:00")], { now })).toEqual(slot(day, "14:00", "15:00"));
    expect(suggestSlot(slot(day, "15:00", "16:00"), [appt("a", day, "15:00", "16:00")], { now })).toEqual(slot(day, "13:15", "14:15"));
  });
  it("uses the Istanbul day for a visit just after midnight", () => {
    // 00:30 Istanbul on the 19th is still the 18th in UTC.
    const busy = [appt("a", day, "08:00", "20:00")];
    expect(suggestSlot(slot(day, "00:30", "01:30"), busy, { now: EARLY })).toEqual(slot("2026-10-20", "09:00", "10:00"));
  });
  it("returns null when both days are full", () => {
    const busy = [appt("a", day, "08:00", "20:00"), appt("b", "2026-10-20", "09:00", "20:00")];
    expect(suggestSlot(slot(day, "10:00", "11:00"), busy, { now: EARLY })).toBeNull();
  });
});
