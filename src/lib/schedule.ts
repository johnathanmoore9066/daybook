import { addDays, daysBetween, mondayOf, weekdayOf } from "./dates";
import type { Shift } from "./types";

// The standing schedule. Two weeks alternate forever; edit this file when the pattern changes.

type Hours = { start: string; end: string };
type WeekPattern = { name: string; days: Partial<Record<number, Hours>> }; // key: 0 = Sunday ... 6 = Saturday

const OPEN_DAY: Hours = { start: "08:00", end: "21:00" };
const SHORT_WEDNESDAY: Hours = { start: "08:00", end: "14:30" };

/** A Monday that starts ROTATION[0]. */
const ROTATION_ANCHOR = "2026-10-12";

export const ROTATION: WeekPattern[] = [
  {
    name: "Weekend week",
    days: {
      1: OPEN_DAY,
      2: OPEN_DAY,
      3: SHORT_WEDNESDAY,
      5: { start: "16:00", end: "21:00" },
      6: { start: "14:00", end: "21:00" },
    },
  },
  {
    name: "Thursday week",
    days: { 1: OPEN_DAY, 2: OPEN_DAY, 3: SHORT_WEDNESDAY, 4: OPEN_DAY },
  },
];

/** The restaurant is closed Sundays. */
export function isClosed(date: string): boolean {
  return weekdayOf(date) === 0;
}

export function rotationWeek(date: string): WeekPattern {
  const weeks = Math.round(daysBetween(ROTATION_ANCHOR, mondayOf(date)) / 7);
  const n = ROTATION.length;
  return ROTATION[((weeks % n) + n) % n];
}

export type ScheduledShift = Shift & { source: "rotation" | "manual" };

export function rotationShift(date: string): ScheduledShift | null {
  if (isClosed(date)) return null;
  const hours = rotationWeek(date).days[weekdayOf(date)];
  return hours ? { id: `rotation:${date}`, date, ...hours, role: null, source: "rotation" } : null;
}

/**
 * Shifts actually worked from `from` through `to`. A hand-entered shift replaces the rotation for
 * its day (swaps, extra hours); a day marked off drops that day's rotation shift.
 */
export function effectiveShifts(input: {
  manual: Shift[];
  daysOff: string[];
  from: string;
  to: string;
}): ScheduledShift[] {
  const off = new Set(input.daysOff);
  const out: ScheduledShift[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    const manual = input.manual.filter((s) => s.date === date);
    if (manual.length) {
      out.push(...manual.map((s) => ({ ...s, source: "manual" as const })));
      continue;
    }
    const shift = off.has(date) ? null : rotationShift(date);
    if (shift) out.push(shift);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** The next day the restaurant is open, counting `date` itself. */
export function nextOpenDay(date: string): string {
  return isClosed(date) ? addDays(date, 1) : date;
}
