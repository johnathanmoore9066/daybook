import { addDays, toMinutes } from "./dates";
import { isClosed } from "./schedule";
import type { AreaEvent, AreaEventKind, DayOutlook, FeedItem, Reminder, Shift } from "./types";

export type DueItem = {
  id: string;
  title: string;
  course: string | null;
  due: string;
  time: string | null;
  done: boolean;
  source: "manual" | "feed";
  url: string | null;
};

export type AgendaItem =
  | { kind: "shift"; key: string; time: string; end: string; role: string | null; changed: boolean }
  | { kind: "due"; key: string; time: string | null; item: DueItem }
  | {
      kind: "town";
      key: string;
      time: string | null;
      endTime: string | null;
      title: string;
      venue: string | null;
      note: string | null;
      eventKind: AreaEventKind;
    };

export type AgendaDay = { date: string; items: AgendaItem[]; outlook: DayOutlook | null; closed: boolean };

export function toDueItems(reminders: Reminder[], feed: FeedItem[], feedDone: string[]): DueItem[] {
  const done = new Set(feedDone);
  return [
    ...reminders.map((r) => ({ ...r, source: "manual" as const, url: null })),
    ...feed.map((f) => ({ ...f, done: done.has(f.id), source: "feed" as const })),
  ].sort(byDue);
}

function byDue(a: DueItem, b: DueItem) {
  return a.due.localeCompare(b.due) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
}

/** Untimed items lead the day; the rest run in clock order, shifts first on ties. */
function byTime(a: AgendaItem, b: AgendaItem) {
  const at = a.time === null ? -1 : toMinutes(a.time);
  const bt = b.time === null ? -1 : toMinutes(b.time);
  if (at !== bt) return at - bt;
  return order[a.kind] - order[b.kind];
}
const order = { shift: 0, due: 1, town: 2 } as const;

export function buildAgenda(input: {
  today: string;
  days: number;
  shifts: (Shift & { source?: "rotation" | "manual" })[];
  due: DueItem[];
  events: AreaEvent[];
  outlooks?: DayOutlook[];
}): AgendaDay[] {
  const result: AgendaDay[] = [];
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.today, i);
    const items: AgendaItem[] = [
      ...input.shifts
        .filter((s) => s.date === date)
        .map((s) => ({
          kind: "shift" as const,
          key: `shift:${s.id}`,
          time: s.start,
          end: s.end,
          role: s.role,
          changed: s.source === "manual",
        })),
      ...input.due
        .filter((d) => d.due === date && !d.done)
        .map((d) => ({ kind: "due" as const, key: `due:${d.source}:${d.id}`, time: d.time, item: d })),
      ...input.events
        .filter((e) => e.date === date)
        .map((e, n) => ({
          kind: "town" as const,
          key: `town:${date}:${n}`,
          time: e.time,
          endTime: e.endTime,
          title: e.title,
          venue: e.venue,
          note: e.note,
          eventKind: e.kind,
        })),
    ];
    const closed = isClosed(date);
    // The report forecasts restaurant traffic every day, including days the restaurant is closed.
    const outlook = closed ? null : (input.outlooks?.find((o) => o.date === date) ?? null);
    result.push({ date, items: items.sort(byTime), outlook, closed });
  }
  return result;
}

function shiftEndMinutes(s: Shift): number {
  return s.end === "close" ? 24 * 60 : toMinutes(s.end);
}

/** The shift happening now or next. A shift whose end is earlier than its start runs past midnight. */
export function nextShift(shifts: Shift[], today: string, nowMinutes: number): Shift | null {
  const upcoming = shifts
    .filter((s) => {
      if (s.date > today) return true;
      if (s.date < today) return false;
      const end = shiftEndMinutes(s);
      const overnight = end <= toMinutes(s.start);
      return overnight || end > nowMinutes;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return upcoming[0] ?? null;
}

export function dueSummary(due: DueItem[], today: string) {
  const last = addDays(today, 6);
  const open = due.filter((d) => !d.done);
  return {
    // Calendar feeds carry the whole term, including work already turned in elsewhere,
    // so only hand-entered reminders can be overdue.
    overdue: open.filter((d) => d.source === "manual" && d.due < today),
    today: open.filter((d) => d.due === today),
    nextSevenDays: open.filter((d) => d.due >= today && d.due <= last),
  };
}

export function visibleDue(due: DueItem[], today: string): DueItem[] {
  return due.filter((d) => (d.source === "manual" ? !d.done || d.due >= addDays(today, -7) : d.due >= today));
}
