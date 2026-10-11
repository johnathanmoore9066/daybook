import { describe, expect, it } from "vitest";
import {
  chooseEdition,
  currentReport,
  eventsInRange,
  isPdf,
  outlookInRange,
  pruneReports,
  resolveWeekOf,
  sha256Hex,
} from "./area";
import type { AreaEvent, AreaReport, DayOutlook, Extraction } from "./types";

function report(partial: Partial<AreaReport> & Pick<AreaReport, "id" | "weekOf" | "receivedAt">): AreaReport {
  return {
    edition: "original",
    filename: "area-report.pdf",
    size: 182_340,
    sha256: partial.id,
    source: "email",
    extraction: { status: "off" },
    ...partial,
  };
}

function done(events: AreaEvent[], days: DayOutlook[] = []): Extraction {
  return { status: "done", summary: "", events, days, model: "test", finishedAt: "2026-10-12T12:00:00Z" };
}

function event(date: string, title: string): AreaEvent {
  return { date, time: "19:30", endTime: null, title, venue: null, kind: "concert", note: null };
}

describe("isPdf", () => {
  it("checks the %PDF- signature", () => {
    expect(isPdf(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true);
    expect(isPdf(new TextEncoder().encode("<html>not a pdf</html>"))).toBe(false);
    expect(isPdf(new Uint8Array())).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("hashes bytes to hex", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("chooseEdition", () => {
  const monday = report({ id: "a", weekOf: "2026-10-12", receivedAt: "2026-10-12T11:02:00Z" });

  it("treats the first report of a week as the original", () => {
    expect(chooseEdition([], "2026-10-12")).toBe("original");
    expect(chooseEdition([monday], "2026-10-19")).toBe("original");
  });

  it("treats a second report in the same week as the update", () => {
    expect(chooseEdition([monday], "2026-10-12")).toBe("update");
  });

  it("honors an explicit edition from the sender", () => {
    expect(chooseEdition([], "2026-10-12", "update")).toBe("update");
  });
});

describe("currentReport", () => {
  const lastWeek = report({ id: "old", weekOf: "2026-10-05", receivedAt: "2026-10-05T11:00:00Z" });
  const monday = report({ id: "mon", weekOf: "2026-10-12", receivedAt: "2026-10-12T11:02:00Z" });
  const thursday = report({
    id: "thu",
    weekOf: "2026-10-12",
    receivedAt: "2026-10-15T11:05:00Z",
    edition: "update",
  });

  it("returns null with no reports", () => {
    expect(currentReport([], "2026-10-13")).toBeNull();
  });

  it("prefers the update and links the report it replaces", () => {
    const result = currentReport([monday, thursday, lastWeek], "2026-10-16");
    expect(result?.report.id).toBe("thu");
    expect(result?.replaces?.id).toBe("mon");
    expect(result?.timing).toBe("this-week");
  });

  it("marks an older week's report as stale once its week is over", () => {
    expect(currentReport([lastWeek], "2026-10-11")?.timing).toBe("this-week"); // Sunday closes the Oct 5 week
    expect(currentReport([lastWeek], "2026-10-12")?.timing).toBe("stale");
  });

  it("shows a report that arrived early for next week, and flags it beside this week's", () => {
    // Prepared Thursday Oct 8 for the week of Oct 12.
    const early = report({ id: "early", weekOf: "2026-10-12", receivedAt: "2026-10-08T15:00:00Z" });
    expect(currentReport([early], "2026-10-09")).toMatchObject({ timing: "upcoming", report: { id: "early" } });
    const both = currentReport([early, lastWeek], "2026-10-09");
    expect(both?.report.id).toBe("old");
    expect(both?.upcoming?.id).toBe("early");
  });
});

describe("eventsInRange", () => {
  it("uses the update's events over the original for the same week", () => {
    const monday = report({
      id: "mon",
      weekOf: "2026-10-12",
      receivedAt: "2026-10-12T11:00:00Z",
      extraction: done([event("2026-10-16", "Concert, original time")]),
    });
    const thursday = report({
      id: "thu",
      weekOf: "2026-10-12",
      edition: "update",
      receivedAt: "2026-10-15T11:00:00Z",
      extraction: done([event("2026-10-16", "Concert, moved to 8:00")]),
    });
    const events = eventsInRange([monday, thursday], "2026-10-15", "2026-10-21");
    expect(events.map((e) => e.title)).toEqual(["Concert, moved to 8:00"]);
  });

  it("falls back to the original when the update could not be read", () => {
    const monday = report({
      id: "mon",
      weekOf: "2026-10-12",
      receivedAt: "2026-10-12T11:00:00Z",
      extraction: done([event("2026-10-17", "Gamecocks home game")]),
    });
    const thursday = report({
      id: "thu",
      weekOf: "2026-10-12",
      edition: "update",
      receivedAt: "2026-10-15T11:00:00Z",
      extraction: { status: "failed", error: "timeout", finishedAt: "2026-10-15T11:01:00Z" },
    });
    expect(eventsInRange([monday, thursday], "2026-10-12", "2026-10-18")).toHaveLength(1);
  });

  it("lets a new week's report own its own dates", () => {
    const lastWeek = report({
      id: "old",
      weekOf: "2026-10-05",
      receivedAt: "2026-10-05T11:00:00Z",
      extraction: done([event("2026-10-11", "Soda City Market"), event("2026-10-12", "Early preview of Monday")]),
    });
    const thisWeek = report({
      id: "new",
      weekOf: "2026-10-12",
      receivedAt: "2026-10-12T11:00:00Z",
      extraction: done([event("2026-10-12", "Monday trivia, final")]),
    });
    const titles = eventsInRange([lastWeek, thisWeek], "2026-10-11", "2026-10-12").map((e) => e.title);
    expect(titles).toEqual(["Soda City Market", "Monday trivia, final"]);
  });
});

describe("pruneReports", () => {
  it("keeps the newest reports", () => {
    const reports = [
      report({ id: "1", weekOf: "2026-09-28", receivedAt: "2026-09-28T11:00:00Z" }),
      report({ id: "3", weekOf: "2026-10-12", receivedAt: "2026-10-12T11:00:00Z" }),
      report({ id: "2", weekOf: "2026-10-05", receivedAt: "2026-10-05T11:00:00Z" }),
    ];
    const { kept, dropped } = pruneReports(reports, 2);
    expect(kept.map((r) => r.id)).toEqual(["3", "2"]);
    expect(dropped.map((r) => r.id)).toEqual(["1"]);
  });
});

describe("resolveWeekOf", () => {
  it("takes an explicit week first", () => {
    expect(resolveWeekOf({ explicit: "2026-10-14", filename: "report-2026-10-05.pdf", received: "2026-10-08" })).toBe(
      "2026-10-12",
    );
  });

  it("reads the week from a dated filename when the report arrives early", () => {
    expect(resolveWeekOf({ filename: "columbia-event-report-2026-10-12.pdf", received: "2026-10-08" })).toBe(
      "2026-10-12",
    );
  });

  it("falls back to the arrival date", () => {
    expect(resolveWeekOf({ filename: "area report.pdf", received: "2026-10-15" })).toBe("2026-10-12");
    expect(resolveWeekOf({ explicit: "next week", filename: null, received: "2026-10-15" })).toBe("2026-10-12");
  });
});

describe("outlookInRange", () => {
  it("returns each day's busyness from the newest report for that week", () => {
    const original = report({
      id: "a",
      weekOf: "2026-10-12",
      receivedAt: "2026-10-08T15:00:00Z",
      extraction: done([], [{ date: "2026-10-17", level: "high", outlook: "Fair and festival" }]),
    });
    const update = report({
      id: "b",
      weekOf: "2026-10-12",
      edition: "update",
      receivedAt: "2026-10-15T15:00:00Z",
      extraction: done([], [{ date: "2026-10-17", level: "very_high", outlook: "Pride Festival plus a fair day" }]),
    });
    expect(outlookInRange([original, update], "2026-10-12", "2026-10-18")).toEqual([
      { date: "2026-10-17", level: "very_high", outlook: "Pride Festival plus a fair day" },
    ]);
  });
});
