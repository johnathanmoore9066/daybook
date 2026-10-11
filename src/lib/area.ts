import { isIsoDate, mondayOf } from "./dates";
import type { AreaEvent, AreaReport, DayOutlook, Extraction, ReportEdition } from "./types";

// Vercel functions reject request bodies over 4.5 MB.
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const KEEP_REPORTS = 30;

export function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The first report for a week is the original; anything after it is an update. */
export function chooseEdition(reports: AreaReport[], weekOf: string, requested?: ReportEdition | null): ReportEdition {
  if (requested) return requested;
  return reports.some((r) => r.weekOf === weekOf) ? "update" : "original";
}

function newestFirst(a: AreaReport, b: AreaReport) {
  return b.receivedAt.localeCompare(a.receivedAt);
}

export type CurrentReport = {
  report: AreaReport;
  /** "this-week" covers today; "upcoming" arrived early for a later week; "stale" is the newest of an older week. */
  timing: "this-week" | "upcoming" | "stale";
  /** The earlier report for the same week, when `report` is an update. */
  replaces: AreaReport | null;
  /** A report for a later week that has already arrived, shown alongside this week's. */
  upcoming: AreaReport | null;
};

export function currentReport(reports: AreaReport[], today: string): CurrentReport | null {
  if (reports.length === 0) return null;
  const sorted = [...reports].sort(newestFirst);
  const week = mondayOf(today);
  const thisWeek = sorted.find((r) => r.weekOf === week);
  const nextUp = sorted
    .filter((r) => r.weekOf > week)
    .sort((a, b) => a.weekOf.localeCompare(b.weekOf) || newestFirst(a, b))[0];

  const report = thisWeek ?? nextUp ?? sorted[0];
  const timing = thisWeek ? "this-week" : nextUp ? "upcoming" : "stale";
  const replaces =
    report.edition === "update" ? (sorted.find((r) => r.weekOf === report.weekOf && r.id !== report.id) ?? null) : null;
  return { report, timing, replaces, upcoming: thisWeek && nextUp ? nextUp : null };
}

/**
 * Week a report covers. The sender's explicit week wins, then a date in the filename
 * (the agent names files like columbia-event-report-2026-10-12.pdf), then the arrival date.
 */
export function resolveWeekOf(input: { explicit?: string | null; filename?: string | null; received: string }): string {
  if (input.explicit && isIsoDate(input.explicit)) return mondayOf(input.explicit);
  const fromName = input.filename?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (fromName && isIsoDate(fromName)) return mondayOf(fromName);
  return mondayOf(input.received);
}

type Dated = { date: string };

/**
 * Items for each date come from the newest readable report for that date's week. A date whose
 * week has no readable report falls back to the newest report that mentions it.
 */
function byDate<T extends Dated>(
  reports: AreaReport[],
  from: string,
  to: string,
  pick: (x: Extract<Extraction, { status: "done" }>) => T[],
): T[] {
  const readable = reports.filter((r) => r.extraction.status === "done").sort(newestFirst);
  // Reports read before a field existed have it missing in stored state.
  const itemsOf = (r: AreaReport) => (r.extraction.status === "done" ? (pick(r.extraction) ?? []) : []);

  const byWeek = new Map<string, AreaReport>();
  for (const r of readable) if (!byWeek.has(r.weekOf)) byWeek.set(r.weekOf, r);

  const dates = new Set<string>();
  for (const r of readable)
    for (const item of itemsOf(r)) if (item.date >= from && item.date <= to) dates.add(item.date);

  const out: T[] = [];
  for (const date of [...dates].sort()) {
    const owner = byWeek.get(mondayOf(date)) ?? readable.find((r) => itemsOf(r).some((i) => i.date === date));
    if (owner) out.push(...itemsOf(owner).filter((i) => i.date === date));
  }
  return out;
}

export function eventsInRange(reports: AreaReport[], from: string, to: string): AreaEvent[] {
  return byDate(reports, from, to, (x) => x.events);
}

export function outlookInRange(reports: AreaReport[], from: string, to: string): DayOutlook[] {
  return byDate(reports, from, to, (x) => x.days);
}

export function pruneReports(reports: AreaReport[], keep: number = KEEP_REPORTS) {
  const sorted = [...reports].sort(newestFirst);
  return { kept: sorted.slice(0, keep), dropped: sorted.slice(keep) };
}
