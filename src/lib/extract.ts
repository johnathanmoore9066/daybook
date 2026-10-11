import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { isHhmm, isIsoDate } from "./dates";
import type { AreaEvent, DayOutlook } from "./types";

// Haiku handles listing dated items from a short report well, at a fraction of a cent per run.
// Prompt caching is left off on purpose: the PDF changes every call and runs twice a week,
// so nothing repeats inside the cache window.
export const EXTRACTION_MODEL = "claude-haiku-5-5";

const KINDS = ["concert", "sports", "festival", "school", "weather", "roadwork", "community", "tv", "other"] as const;
const LEVELS = ["quiet", "moderate", "high", "very_high"] as const;

const ReportSchema = z.object({
  summary: z.string().describe("Two plain sentences on what the week looks like overall, in the report's own terms."),
  days: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      level: z
        .enum(LEVELS)
        .nullable()
        .describe(
          "The report's own busyness rating for the day (Quiet, Moderate, High, Very high). null if it gives none.",
        ),
      outlook: z.string().nullable().describe("The report's one-line read on the day, under 20 words. null if none."),
    }),
  ),
  events: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      time: z.string().nullable().describe("Start time, 24-hour HH:MM. null if the report gives no time."),
      endTime: z.string().nullable().describe("End time, 24-hour HH:MM. null if not stated."),
      title: z
        .string()
        .describe("Short calendar-style title, e.g. 'Gamecocks vs. Kentucky' or 'Assembly St. lane closure'."),
      venue: z.string().nullable(),
      kind: z.enum(KINDS),
      note: z
        .string()
        .nullable()
        .describe(
          "What the report says this means (rush expected, road closed, early close), under 20 words. null if nothing.",
        ),
    }),
  ),
});

const SYSTEM = `You turn a weekly local-events report into dated calendar entries.

The report covers one week in the reader's area. It can include concerts, festivals, sports with start times, school closings, weather, roadwork, and notes on how the week may affect business at the restaurant where the reader works.

- Add one entry per dated happening. A multi-day item gets one entry per day it appears under.
- Days rated with nothing over the reporting threshold get no event entries, but still get a days entry.
- Broadcasts listed as big TV nights are kind "tv"; keep them, since they change takeout and bar traffic.
- Road closures and detours are kind "roadwork"; no-school days are kind "school"; daily forecasts are kind "weather" only when the report flags them (storms, rain, extreme heat).
- Resolve weekday names and partial dates against the week the report covers.
- Copy times exactly as written. Use null when no time is given rather than estimating one.
- Include only what the report states. Do not add events from outside knowledge.`;

export type ExtractedReport = { summary: string; events: AreaEvent[]; days: DayOutlook[] };

export async function extractEvents(pdf: Uint8Array, weekOf: string): Promise<ExtractedReport> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: EXTRACTION_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pdf).toString("base64") },
          },
          { type: "text", text: `This report covers the week starting Monday ${weekOf}.` },
        ],
      },
    ],
    output_config: { effort: "low", format: zodOutputFormat(ReportSchema) },
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to read this report.");
  if (response.stop_reason === "max_tokens") throw new Error("The report was too long to list in one pass.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("The model's answer did not match the expected format.");

  return {
    summary: parsed.summary.trim(),
    days: parsed.days
      .filter((d) => isIsoDate(d.date))
      .map((d) => ({ date: d.date, level: d.level, outlook: d.outlook?.trim() || null })),
    events: parsed.events
      .filter((e) => isIsoDate(e.date) && e.title.trim())
      .map((e) => ({
        ...e,
        title: e.title.trim(),
        time: e.time && isHhmm(e.time) ? e.time : null,
        endTime: e.endTime && isHhmm(e.endTime) ? e.endTime : null,
      })),
  };
}

export function describeExtractionError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY was rejected.";
  if (error instanceof Anthropic.RateLimitError) return "Rate limited by the Claude API. Try again in a minute.";
  if (error instanceof Anthropic.BadRequestError) return `Claude API rejected the request: ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status ?? ""}: ${error.message}`.trim();
  if (error instanceof Error) return error.message;
  return "Unknown error while reading the report.";
}
