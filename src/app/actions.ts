"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS, secretsMatch } from "@/lib/auth";
import { config } from "@/lib/config";
import { addDays, isHhmm, isIsoDate, todayIn } from "@/lib/dates";
import { IngestError, ingestReport, runExtraction } from "@/lib/ingest";
import { isClosed } from "@/lib/schedule";
import { requireSession } from "@/lib/session";
import { files, reportFileName, updateState } from "@/lib/store";

const refresh = () => revalidatePath("/", "layout");

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : null));

const isoDate = z.string().refine(isIsoDate, "Pick a date.");
const optionalTime = z
  .string()
  .trim()
  .refine((v) => v === "" || isHhmm(v), "Use a time like 4:00 PM.")
  .transform((v) => (v ? v : null));

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

const idField = (formData: FormData) => z.string().min(1).parse(formData.get("id"));

/* Session */

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!config.password) redirect("/");
  const password = String(formData.get("password") ?? "");
  if (!(await secretsMatch(password, config.password))) {
    // Slows down guessing without needing a rate-limit store.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { error: "That password didn't match." };
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(config.sessionSecret!), {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/* Shifts */

export type ShiftFormState = {
  error: string | null;
  saved: number;
  defaults: { date: string; start: string; end: string; untilClose: boolean; role: string };
};

const ShiftInput = z
  .object({
    date: isoDate,
    start: z.string().refine(isHhmm, "Add a start time."),
    end: optionalTime,
    untilClose: z.boolean(),
    role: text(40),
  })
  .refine((v) => !isClosed(v.date), { message: "The restaurant is closed Sundays." })
  .refine((v) => v.untilClose || v.end !== null, { message: "Add an end time or check “until close”." });

export async function addShift(prev: ShiftFormState, formData: FormData): Promise<ShiftFormState> {
  await requireSession();
  const raw = {
    date: String(formData.get("date") ?? ""),
    start: String(formData.get("start") ?? ""),
    end: String(formData.get("end") ?? ""),
    untilClose: formData.get("untilClose") === "on",
    role: String(formData.get("role") ?? ""),
  };
  const parsed = ShiftInput.safeParse(raw);
  if (!parsed.success) return { ...prev, error: firstError(parsed.error), defaults: raw };

  const { date, start, end, untilClose, role } = parsed.data;
  await updateState((state) => {
    state.shifts.push({ id: crypto.randomUUID(), date, start, end: untilClose ? "close" : end!, role });
    state.shifts.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  });
  refresh();
  return { error: null, saved: prev.saved + 1, defaults: raw };
}

export async function deleteShift(formData: FormData) {
  await requireSession();
  const id = idField(formData);
  await updateState((state) => {
    state.shifts = state.shifts.filter((s) => s.id !== id);
  });
  refresh();
}

const dateField = (formData: FormData) => z.string().refine(isIsoDate).parse(formData.get("date"));

export async function takeDayOff(formData: FormData) {
  await requireSession();
  const date = dateField(formData);
  await updateState((state) => {
    if (!state.daysOff.includes(date)) state.daysOff.push(date);
    // Keep the list from growing forever; past days off no longer matter.
    const cutoff = addDays(todayIn(config.tz), -60);
    state.daysOff = state.daysOff.filter((d) => d >= cutoff).sort();
  });
  refresh();
}

export async function restoreDay(formData: FormData) {
  await requireSession();
  const date = dateField(formData);
  await updateState((state) => {
    state.daysOff = state.daysOff.filter((d) => d !== date);
  });
  refresh();
}

/* Reminders */

export type ReminderFormState = { error: string | null; saved: number; defaults: { course: string } };

const ReminderInput = z.object({
  title: z.string().trim().min(1, "Say what's due.").max(140),
  course: text(40),
  due: isoDate,
  time: optionalTime,
});

export async function addReminder(prev: ReminderFormState, formData: FormData): Promise<ReminderFormState> {
  await requireSession();
  const parsed = ReminderInput.safeParse({
    title: String(formData.get("title") ?? ""),
    course: String(formData.get("course") ?? ""),
    due: String(formData.get("due") ?? ""),
    time: String(formData.get("time") ?? ""),
  });
  if (!parsed.success) return { ...prev, error: firstError(parsed.error) };

  await updateState((state) => {
    state.reminders.push({ id: crypto.randomUUID(), ...parsed.data, done: false, createdAt: new Date().toISOString() });
  });
  refresh();
  return { error: null, saved: prev.saved + 1, defaults: { course: parsed.data.course ?? "" } };
}

export async function toggleReminder(formData: FormData) {
  await requireSession();
  const id = idField(formData);
  await updateState((state) => {
    const reminder = state.reminders.find((r) => r.id === id);
    if (reminder) reminder.done = !reminder.done;
  });
  refresh();
}

export async function deleteReminder(formData: FormData) {
  await requireSession();
  const id = idField(formData);
  await updateState((state) => {
    state.reminders = state.reminders.filter((r) => r.id !== id);
  });
  refresh();
}

export async function toggleFeedItem(formData: FormData) {
  await requireSession();
  const id = idField(formData);
  await updateState((state) => {
    state.feedDone = state.feedDone.includes(id)
      ? state.feedDone.filter((f) => f !== id)
      : // Cap the list; old feed items fall out of the feed anyway.
        [...state.feedDone, id].slice(-500);
  });
  refresh();
}

/* Area reports */

export type UploadState = { error: string | null; message: string | null };

export async function uploadReport(_prev: UploadState, formData: FormData): Promise<UploadState> {
  await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF first.", message: null };
  const edition = formData.get("edition");
  try {
    const { report, duplicate } = await ingestReport({
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      source: "upload",
      edition: edition === "original" || edition === "update" ? edition : null,
      weekOf: String(formData.get("weekOf") ?? "") || null,
    });
    if (!duplicate && report.extraction.status === "pending") after(() => runExtraction(report.id));
    refresh();
    return {
      error: null,
      message: duplicate
        ? "That exact PDF is already here. Nothing changed."
        : `Saved as ${report.edition === "original" ? "the weekly report" : "an update"} for the week of ${report.weekOf}.`,
    };
  } catch (error) {
    if (error instanceof IngestError) return { error: error.message, message: null };
    throw error;
  }
}

export async function retryExtraction(formData: FormData) {
  await requireSession();
  const id = idField(formData);
  if (!config.anthropicKey) return;
  await updateState((state) => {
    const report = state.reports.find((r) => r.id === id);
    if (report) report.extraction = { status: "pending", startedAt: new Date().toISOString() };
  });
  after(() => runExtraction(id));
  refresh();
}

export async function deleteReport(formData: FormData) {
  await requireSession();
  const id = idField(formData);
  await updateState((state) => {
    state.reports = state.reports.filter((r) => r.id !== id);
  });
  await files.delete([reportFileName(id)]).catch(() => undefined);
  refresh();
}
