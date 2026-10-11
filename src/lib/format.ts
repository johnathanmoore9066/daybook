import { formatTime, relativeDay } from "./dates";
import type { Shift } from "./types";

export function shiftRange(s: Pick<Shift, "start" | "end">): string {
  return `${formatTime(s.start)}–${s.end === "close" ? "close" : formatTime(s.end)}`;
}

export function dueWhen(due: string, time: string | null, today: string): string {
  const day = relativeDay(due, today);
  return time ? `${day}, ${formatTime(time)}` : day;
}

export function count(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function joinParts(parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}

export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function formatReceived(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const BUSY_LABEL = { quiet: "Quiet", moderate: "Moderate", high: "High", very_high: "Very high" } as const;
