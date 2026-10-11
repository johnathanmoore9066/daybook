import { cacheLife } from "next/cache";
import { currentReport, eventsInRange, outlookInRange } from "./area";
import { buildAgenda, dueSummary, nextShift, toDueItems, visibleDue } from "./agenda";
import { config } from "./config";
import { addDays, minutesNowIn, todayIn, toMinutes } from "./dates";
import { parseIcs, toFeedItems } from "./ics";
import { effectiveShifts, isClosed, nextOpenDay, rotationWeek } from "./schedule";
import { readState } from "./store";
import type { FeedItem, Shift } from "./types";

export type FeedStatus = { status: "off" } | { status: "ok"; items: FeedItem[] } | { status: "error"; message: string };

class FeedHttpError extends Error {}

// School portals rate-limit feed polling, and due dates rarely move within 15 minutes.
async function fetchFeedText(url: string): Promise<string> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new FeedHttpError(`The feed answered ${response.status}.`);
  return response.text();
}

export async function loadSchoolFeed(today: string): Promise<FeedStatus> {
  if (!config.schoolFeedUrl) return { status: "off" };
  try {
    const text = await fetchFeedText(config.schoolFeedUrl);
    const from = addDays(today, -14);
    const to = addDays(today, 120);
    const items = toFeedItems(parseIcs(text, config.tz)).filter((i) => i.due >= from && i.due <= to);
    return { status: "ok", items };
  } catch (error) {
    const message = error instanceof FeedHttpError ? error.message : "Couldn't reach the calendar feed.";
    return { status: "error", message };
  }
}

/** Hours over the same rolling seven days the agenda shows. "Until close" shifts have no fixed length. */
function upcomingHours(shifts: Shift[], today: string) {
  const last = addDays(today, 6);
  let minutes = 0;
  let closes = 0;
  let count = 0;
  for (const s of shifts) {
    if (s.date < today || s.date > last) continue;
    count++;
    if (s.end === "close") {
      closes++;
      continue;
    }
    const span = toMinutes(s.end) - toMinutes(s.start);
    minutes += span > 0 ? span : span + 24 * 60;
  }
  return { hours: minutes / 60, closes, count };
}

export async function loadDashboard(now: Date = new Date()) {
  const today = todayIn(config.tz, now);
  const nowMinutes = minutesNowIn(config.tz, now);
  const [state, feed] = await Promise.all([readState(), loadSchoolFeed(today)]);

  // Two weeks of shifts, stretched to cover any change entered further out.
  const lastManual = state.shifts.reduce((max, s) => (s.date > max ? s.date : max), today);
  const horizon = [addDays(today, 13), lastManual].sort().at(-1)!;
  const shifts = effectiveShifts({ manual: state.shifts, daysOff: state.daysOff, from: today, to: horizon });

  const due = toDueItems(state.reminders, feed.status === "ok" ? feed.items : [], state.feedDone);
  const events = eventsInRange(state.reports, today, addDays(today, 6));
  const outlooks = outlookInRange(state.reports, today, addDays(today, 6));

  return {
    today,
    nowMinutes,
    state,
    feed,
    due: visibleDue(due, today),
    dueSummary: dueSummary(due, today),
    agenda: buildAgenda({ today, days: 7, shifts, due, events, outlooks }),
    closedToday: isClosed(today),
    currentWeek: rotationWeek(nextOpenDay(today)).name,
    upcomingShifts: shifts,
    daysOff: state.daysOff.filter((d) => d >= today && d <= horizon),
    nextShift: nextShift(shifts, today, nowMinutes),
    upcomingHours: upcomingHours(shifts, today),
    report: currentReport(state.reports, today),
    courses: [...new Set(due.map((d) => d.course).filter((c): c is string => Boolean(c)))].sort(),
    roles: [...new Set(state.shifts.map((s) => s.role).filter((r): r is string => Boolean(r)))].sort(),
  };
}

export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
