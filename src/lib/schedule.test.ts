import { describe, expect, it } from "vitest";
import { effectiveShifts, isClosed, nextOpenDay, rotationShift, rotationWeek } from "./schedule";

describe("rotationWeek", () => {
  it("alternates weekly from the week of Oct 12", () => {
    expect(rotationWeek("2026-10-12").name).toBe("Weekend week");
    expect(rotationWeek("2026-10-17").name).toBe("Weekend week"); // Saturday, same week
    expect(rotationWeek("2026-10-19").name).toBe("Thursday week");
    expect(rotationWeek("2026-10-26").name).toBe("Weekend week");
  });

  it("works for weeks before the anchor", () => {
    expect(rotationWeek("2026-10-08").name).toBe("Thursday week");
    expect(rotationWeek("2026-09-30").name).toBe("Weekend week");
  });

  it("keeps alternating across the new year and DST changes", () => {
    // 12 weeks after Oct 12 lands on Jan 4, 2027: an even number of weeks, so the same pattern.
    expect(rotationWeek("2027-01-04").name).toBe("Weekend week");
    expect(rotationWeek("2027-03-22").name).toBe("Thursday week"); // 23 weeks on, after the Mar 14 DST change
  });
});

describe("rotationShift", () => {
  it("returns the weekend week's hours", () => {
    expect(rotationShift("2026-10-12")).toMatchObject({ start: "08:00", end: "21:00" });
    expect(rotationShift("2026-10-14")).toMatchObject({ start: "08:00", end: "14:30" });
    expect(rotationShift("2026-10-15")).toBeNull(); // Thursday off
    expect(rotationShift("2026-10-16")).toMatchObject({ start: "16:00", end: "21:00" });
    expect(rotationShift("2026-10-17")).toMatchObject({ start: "14:00", end: "21:00" });
  });

  it("returns the Thursday week's hours", () => {
    expect(rotationShift("2026-10-22")).toMatchObject({ start: "08:00", end: "21:00" });
    expect(rotationShift("2026-10-23")).toBeNull();
    expect(rotationShift("2026-10-24")).toBeNull();
  });

  it("never schedules a Sunday", () => {
    expect(isClosed("2026-10-18")).toBe(true);
    expect(rotationShift("2026-10-18")).toBeNull();
    expect(rotationShift("2026-10-25")).toBeNull();
  });
});

describe("effectiveShifts", () => {
  const week = { from: "2026-10-12", to: "2026-10-18" };

  it("fills a week from the rotation", () => {
    const shifts = effectiveShifts({ manual: [], daysOff: [], ...week });
    expect(shifts.map((s) => s.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16", "2026-10-17"]);
    expect(shifts.every((s) => s.source === "rotation")).toBe(true);
  });

  it("lets a hand-entered shift replace that day's usual hours", () => {
    const shifts = effectiveShifts({
      manual: [{ id: "swap", date: "2026-10-16", start: "10:00", end: "21:00", role: null }],
      daysOff: [],
      ...week,
    });
    const friday = shifts.filter((s) => s.date === "2026-10-16");
    expect(friday).toEqual([
      { id: "swap", date: "2026-10-16", start: "10:00", end: "21:00", role: null, source: "manual" },
    ]);
  });

  it("adds a hand-entered shift on a normal day off", () => {
    const shifts = effectiveShifts({
      manual: [{ id: "extra", date: "2026-10-15", start: "16:00", end: "21:00", role: null }],
      daysOff: [],
      ...week,
    });
    expect(shifts.find((s) => s.date === "2026-10-15")?.id).toBe("extra");
  });

  it("drops a day taken off", () => {
    const shifts = effectiveShifts({ manual: [], daysOff: ["2026-10-14"], ...week });
    expect(shifts.some((s) => s.date === "2026-10-14")).toBe(false);
  });
});

describe("nextOpenDay", () => {
  it("skips Sunday", () => {
    expect(nextOpenDay("2026-10-11")).toBe("2026-10-12");
    expect(nextOpenDay("2026-10-13")).toBe("2026-10-13");
  });
});
