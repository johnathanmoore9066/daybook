import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatTime, isIsoDate, localDateTime, mondayOf, relativeDay, todayIn } from "./dates";

describe("todayIn", () => {
  it("uses the dashboard time zone, not UTC", () => {
    // 02:30 UTC on Oct 12 is still the evening of Oct 11 in Columbia, SC.
    const now = new Date("2026-10-12T02:30:00Z");
    expect(todayIn("America/New_York", now)).toBe("2026-10-11");
    expect(todayIn("UTC", now)).toBe("2026-10-12");
  });
});

describe("localDateTime", () => {
  it("converts a UTC instant to local wall time across DST", () => {
    expect(localDateTime(new Date("2026-10-16T03:59:00Z"), "America/New_York")).toEqual({
      date: "2026-10-15",
      time: "23:59",
    });
    // After the Nov 1 fall-back, Eastern is UTC-5.
    expect(localDateTime(new Date("2026-11-03T04:59:00Z"), "America/New_York")).toEqual({
      date: "2026-11-02",
      time: "23:59",
    });
  });
});

describe("calendar math", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-11", "2026-10-18")).toBe(7);
    expect(daysBetween("2026-10-18", "2026-10-11")).toBe(-7);
  });

  it("finds the Monday of a week, treating Sunday as the end of the week", () => {
    expect(mondayOf("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(mondayOf("2026-10-15")).toBe("2026-10-12"); // Thursday
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // previous Sunday
  });
});

describe("formatTime", () => {
  it("writes compact 12-hour times", () => {
    expect(formatTime("16:00")).toBe("4:00p");
    expect(formatTime("23:59")).toBe("11:59p");
    expect(formatTime("00:30")).toBe("12:30a");
    expect(formatTime("12:00")).toBe("12:00p");
  });
});

describe("relativeDay", () => {
  const today = "2026-10-11"; // Sunday
  it("names nearby days", () => {
    expect(relativeDay("2026-10-11", today)).toBe("Today");
    expect(relativeDay("2026-10-12", today)).toBe("Tomorrow");
    expect(relativeDay("2026-10-14", today)).toBe("Wed");
    expect(relativeDay("2026-10-10", today)).toBe("Yesterday");
  });
  it("falls back to month and day beyond a week", () => {
    expect(relativeDay("2026-10-21", today)).toBe("Oct 21");
    expect(relativeDay("2026-10-02", today)).toBe("Oct 2");
  });
});

describe("isIsoDate", () => {
  it("rejects impossible dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-10-11")).toBe(true);
    expect(isIsoDate("10/11/2026")).toBe(false);
  });
});
