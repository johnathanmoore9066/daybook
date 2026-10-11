import { localDateTime } from "./dates";
import type { FeedItem } from "./types";

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string | null;
  url: string | null;
  date: string;
  time: string | null;
};

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function parseLine(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

function offsetMinutes(instant: number, tz: string): number {
  const local = localDateTime(new Date(instant), tz);
  const [y, mo, d] = local.date.split("-").map(Number);
  const [h, mi] = local.time.split(":").map(Number);
  return (Date.UTC(y, mo - 1, d, h, mi) - instant) / 60_000;
}

function wallTimeToInstant(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetMinutes(guess, tz) * 60_000;
  const second = offsetMinutes(first, tz);
  return guess - second * 60_000;
}

function parseDate(prop: Prop, tz: string): { date: string; time: string | null } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(prop.value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , utc] = m;
  const date = `${y}-${mo}-${d}`;
  if (h === undefined || prop.params.VALUE === "DATE") return { date, time: null };

  if (utc) {
    return localDateTime(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), tz);
  }
  const zone = prop.params.TZID;
  if (zone && zone !== tz) {
    try {
      return localDateTime(new Date(wallTimeToInstant(+y, +mo, +d, +h, +mi, zone)), tz);
    } catch {
      // Outlook feeds use Windows zone names Intl cannot resolve; wall time is the best guess.
    }
  }
  return { date, time: `${h}:${mi}` };
}

export function parseIcs(text: string, tz: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Prop[] | null = null;

  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      current = [];
    } else if (line === "END:VEVENT") {
      if (current) {
        const get = (name: string) => current!.find((p) => p.name === name);
        const start = get("DTSTART");
        const when = start && parseDate(start, tz);
        const summary = get("SUMMARY");
        if (when && summary) {
          events.push({
            uid: get("UID")?.value ?? `${when.date}:${summary.value}`,
            summary: unescapeText(summary.value).trim(),
            description: get("DESCRIPTION") ? unescapeText(get("DESCRIPTION")!.value) : null,
            url: get("URL")?.value ?? null,
            ...when,
          });
        }
      }
      current = null;
    } else if (current) {
      const prop = parseLine(line);
      if (prop) current.push(prop);
    }
  }
  return events;
}

const COURSE_TAG = /^(.*\S)\s*\[([^\]]+)\]$/;
const TERM_SUFFIX = /\s+(Fall|Spring|Summer|Winter)\s+\d{4}$/i;

export function toFeedItems(events: IcsEvent[]): FeedItem[] {
  return events.map((e) => {
    const tagged = COURSE_TAG.exec(e.summary);
    return {
      id: e.uid,
      title: tagged ? tagged[1] : e.summary,
      course: tagged ? tagged[2].replace(TERM_SUFFIX, "") : null,
      due: e.date,
      time: e.time,
      url: e.url,
    };
  });
}
