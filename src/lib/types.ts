/** A hand-entered shift. The standing rotation lives in schedule.ts and is never stored. */
export type Shift = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM, 24h
  end: string | "close"; // restaurants often schedule "until close" with no fixed time
  role: string | null;
};

export type Reminder = {
  id: string;
  title: string;
  course: string | null;
  due: string; // YYYY-MM-DD
  time: string | null; // HH:MM, or null for "any time that day"
  done: boolean;
  createdAt: string; // ISO instant
};

/** A due item read from the school's calendar feed. Read-only; completion is tracked in State.feedDone. */
export type FeedItem = {
  id: string;
  title: string;
  course: string | null;
  due: string;
  time: string | null;
  url: string | null;
};

export type AreaEventKind =
  "concert" | "sports" | "festival" | "school" | "weather" | "roadwork" | "community" | "tv" | "other";

export type AreaEvent = {
  date: string;
  time: string | null;
  endTime: string | null;
  title: string;
  venue: string | null;
  kind: AreaEventKind;
  note: string | null;
};

export type BusyLevel = "quiet" | "moderate" | "high" | "very_high";

/** The report's call on a whole day: how busy, and its one-line outlook. */
export type DayOutlook = {
  date: string;
  level: BusyLevel | null;
  outlook: string | null;
};

export type Extraction =
  | { status: "off" }
  | { status: "pending"; startedAt: string }
  | {
      status: "done";
      summary: string;
      events: AreaEvent[];
      days: DayOutlook[];
      model: string;
      finishedAt: string;
    }
  | { status: "failed"; error: string; finishedAt: string };

/** The first report filed for a week is the original; any later one for that week is an update. */
export type ReportEdition = "original" | "update";
export type ReportSource = "agent" | "email" | "upload";

export type AreaReport = {
  id: string;
  weekOf: string; // Monday of the week the report covers, which can be after the day it arrived
  edition: ReportEdition;
  receivedAt: string; // ISO instant
  filename: string;
  size: number;
  sha256: string;
  source: ReportSource;
  extraction: Extraction;
};

export type State = {
  version: 1;
  shifts: Shift[];
  /** Dates when a rotation shift is skipped (time off, a swap with nothing in its place). */
  daysOff: string[];
  reminders: Reminder[];
  feedDone: string[];
  reports: AreaReport[];
};

export const EMPTY_STATE: State = {
  version: 1,
  shifts: [],
  daysOff: [],
  reminders: [],
  feedDone: [],
  reports: [],
};
