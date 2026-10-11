// Calendar dates are plain "YYYY-MM-DD" strings in the dashboard's time zone.
// Vercel runs in UTC, so "today" must always be computed against TZ, never the server clock.

export const TZ = process.env.DASHBOARD_TZ || "America/New_York";

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

export function localDateTime(date: Date, tz: string = TZ): { date: string; time: string } {
  const p = parts(date, tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function todayIn(tz: string = TZ, now: Date = new Date()): string {
  return localDateTime(now, tz).date;
}

export function minutesNowIn(tz: string = TZ, now: Date = new Date()): number {
  return toMinutes(localDateTime(now, tz).time);
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(iso: string): number {
  return toUtc(iso).getUTCDay();
}

/** The Monday that starts the week containing `iso`. The area report is published per Monday-week. */
export function mondayOf(iso: string): string {
  const offset = (weekdayOf(iso) + 6) % 7;
  return addDays(iso, -offset);
}

export function describeDay(iso: string) {
  const d = toUtc(iso);
  return {
    dow: DOW_SHORT[d.getUTCDay()],
    dowLong: DOW_LONG[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTH_SHORT[d.getUTCMonth()],
    monthLong: MONTH_LONG[d.getUTCMonth()],
    year: d.getUTCFullYear(),
  };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "16:00" -> "4:00p", "00:30" -> "12:30a". Short form keeps the time column narrow on phones. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/** "Today", "Tomorrow", "Wed" within the coming week, otherwise "Oct 21". Past dates read "Yesterday" or "Oct 2". */
export function relativeDay(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = describeDay(iso);
  if (diff > 1 && diff < 7) return d.dow;
  return `${d.month} ${d.day}`;
}

export function formatShortDate(iso: string): string {
  const d = describeDay(iso);
  return `${d.dow}, ${d.month} ${d.day}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function isHhmm(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
