import { describe, expect, it } from "vitest";
import { buildAgenda, dueSummary, nextShift, toDueItems } from "./agenda";
import type { AreaEvent, FeedItem, Reminder, Shift } from "./types";

const shifts: Shift[] = [
  { id: "s1", date: "2026-10-13", start: "16:00", end: "close", role: "Server" },
  { id: "s2", date: "2026-10-11", start: "10:30", end: "15:00", role: "Brunch" },
  { id: "s3", date: "2026-10-16", start: "17:00", end: "23:00", role: null },
];

const reminders: Reminder[] = [
  {
    id: "r1",
    title: "Lab report draft",
    course: "BIOL 110",
    due: "2026-10-13",
    time: "09:00",
    done: false,
    createdAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "r2",
    title: "Email advisor about spring schedule",
    course: null,
    due: "2026-10-08",
    time: null,
    done: false,
    createdAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "r3",
    title: "Reading response 5",
    course: "ENGL 102",
    due: "2026-10-12",
    time: "23:59",
    done: true,
    createdAt: "2026-10-01T00:00:00Z",
  },
];

const feed: FeedItem[] = [
  { id: "f1", title: "Quiz 4", course: "BIOL 110", due: "2026-10-13", time: null, url: null },
  { id: "f0", title: "Discussion post 3", course: "PSYC 101", due: "2026-09-30", time: "23:59", url: null },
];

const events: AreaEvent[] = [
  {
    date: "2026-10-13",
    time: "19:30",
    endTime: null,
    title: "Concert at Colonial Life Arena",
    venue: "Colonial Life Arena",
    kind: "concert",
    note: "Expect a 5 to 7 pm dinner rush",
  },
];

describe("buildAgenda", () => {
  const due = toDueItems(reminders, feed, []);
  const days = buildAgenda({ today: "2026-10-11", days: 7, shifts, due, events });

  it("covers the requested number of days starting today", () => {
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
  });

  it("merges shifts, due work and area events into one day, untimed first", () => {
    const tuesday = days[2];
    expect(tuesday.items.map((i) => i.kind)).toEqual(["due", "due", "shift", "town"]);
    expect(tuesday.items[0]).toMatchObject({ kind: "due", time: null });
    expect(tuesday.items[1]).toMatchObject({ kind: "due", time: "09:00" });
  });

  it("leaves completed work off the agenda", () => {
    expect(days[1].items).toHaveLength(0);
  });

  it("marks Sundays closed and drops the report's traffic forecast for them", () => {
    const withOutlooks = buildAgenda({
      today: "2026-10-17",
      days: 2,
      shifts: [],
      due: [],
      events: [],
      outlooks: [
        { date: "2026-10-17", level: "very_high", outlook: "Pride Festival plus a fair day" },
        { date: "2026-10-18", level: "high", outlook: "Steady fair traffic" },
      ],
    });
    expect(withOutlooks[0]).toMatchObject({ closed: false, outlook: { level: "very_high" } });
    expect(withOutlooks[1]).toMatchObject({ closed: true, outlook: null });
  });
});

describe("nextShift", () => {
  it("returns today's shift while it is still running", () => {
    expect(nextShift(shifts, "2026-10-11", 12 * 60)?.id).toBe("s2");
  });

  it("moves on once today's shift has ended", () => {
    expect(nextShift(shifts, "2026-10-11", 15 * 60 + 1)?.id).toBe("s1");
  });

  it("treats a close shift as running until midnight", () => {
    expect(nextShift(shifts, "2026-10-13", 23 * 60)?.id).toBe("s1");
  });

  it("keeps an overnight shift current past its nominal end", () => {
    const late: Shift[] = [{ id: "n", date: "2026-10-11", start: "22:00", end: "02:00", role: null }];
    expect(nextShift(late, "2026-10-11", 23 * 60)?.id).toBe("n");
  });

  it("returns null with nothing ahead", () => {
    expect(nextShift(shifts, "2026-10-20", 0)).toBeNull();
  });
});

describe("dueSummary", () => {
  it("flags overdue hand-entered reminders but not old feed items", () => {
    const summary = dueSummary(toDueItems(reminders, feed, []), "2026-10-11");
    expect(summary.overdue.map((d) => d.id)).toEqual(["r2"]);
    expect(summary.nextSevenDays.map((d) => d.id)).toEqual(["r1", "f1"]);
  });

  it("respects feed items checked off in the dashboard", () => {
    const summary = dueSummary(toDueItems(reminders, feed, ["f1"]), "2026-10-11");
    expect(summary.nextSevenDays.map((d) => d.id)).toEqual(["r1"]);
  });
});
