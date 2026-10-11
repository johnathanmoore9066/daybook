import { describe, expect, it } from "vitest";
import { parseIcs, toFeedItems } from "./ics";

// Shaped like a Canvas calendar feed: assignments due at 11:59 PM Eastern are stored in UTC,
// long summaries are folded at 75 octets, and all-day items use VALUE=DATE.
const CANVAS_FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Instructure//Canvas//EN",
  "BEGIN:VEVENT",
  "DTSTART:20261016T035900Z",
  "DTEND:20261016T035900Z",
  "UID:event-assignment-881204",
  "SUMMARY:Annotated bibliography: six peer-reviewed sources on food deserts [E",
  " NGL 102-014 Fall 2026]",
  "DESCRIPTION:Use APA 7\\, double spaced.\\nSubmit as .docx.",
  "URL;VALUE=URI:https://canvas.example.edu/courses/5512/assignments/881204",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261020",
  "DTEND;VALUE=DATE:20261021",
  "UID:event-calendar-event-1990",
  "SUMMARY:Fall break (no classes) [USC Columbia]",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/New_York:20261019T093000",
  "UID:event-quiz-3301",
  "SUMMARY:Quiz 4: cell respiration",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs", () => {
  it("unfolds lines and unescapes text", () => {
    const [first] = parseIcs(CANVAS_FEED, "America/New_York");
    expect(first.summary).toBe(
      "Annotated bibliography: six peer-reviewed sources on food deserts [ENGL 102-014 Fall 2026]",
    );
    expect(first.description).toBe("Use APA 7, double spaced.\nSubmit as .docx.");
    expect(first.url).toBe("https://canvas.example.edu/courses/5512/assignments/881204");
  });

  it("converts UTC times to local wall time", () => {
    const [first] = parseIcs(CANVAS_FEED, "America/New_York");
    expect(first.date).toBe("2026-10-15");
    expect(first.time).toBe("23:59");
  });

  it("keeps all-day events timeless", () => {
    const events = parseIcs(CANVAS_FEED, "America/New_York");
    expect(events[1]).toMatchObject({ date: "2026-10-20", time: null });
  });

  it("reads TZID times as wall time", () => {
    const events = parseIcs(CANVAS_FEED, "America/New_York");
    expect(events[2]).toMatchObject({ date: "2026-10-19", time: "09:30" });
  });

  it("tolerates LF-only line endings", () => {
    const events = parseIcs(CANVAS_FEED.replace(/\r\n/g, "\n"), "America/New_York");
    expect(events).toHaveLength(3);
    expect(events[0].summary.endsWith("[ENGL 102-014 Fall 2026]")).toBe(true);
  });
});

describe("toFeedItems", () => {
  it("splits a trailing [course] tag into its own field", () => {
    const items = toFeedItems(parseIcs(CANVAS_FEED, "America/New_York"));
    expect(items[0]).toMatchObject({
      id: "event-assignment-881204",
      title: "Annotated bibliography: six peer-reviewed sources on food deserts",
      course: "ENGL 102-014",
      due: "2026-10-15",
      time: "23:59",
    });
    expect(items[2]).toMatchObject({ title: "Quiz 4: cell respiration", course: null });
  });

  it("drops the term suffix but keeps short course tags intact", () => {
    const items = toFeedItems(parseIcs(CANVAS_FEED, "America/New_York"));
    expect(items[1].course).toBe("USC Columbia");
  });
});
