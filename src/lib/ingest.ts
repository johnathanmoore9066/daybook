import { chooseEdition, isPdf, MAX_PDF_BYTES, pruneReports, resolveWeekOf, sha256Hex } from "./area";
import { config } from "./config";
import { localDateTime } from "./dates";
import { describeExtractionError, EXTRACTION_MODEL, extractEvents } from "./extract";
import { files, readState, reportFileName, updateState } from "./store";
import type { AreaReport, ReportEdition, ReportSource } from "./types";

export class IngestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type IngestInput = {
  bytes: Uint8Array;
  filename: string | null;
  source: ReportSource;
  edition?: ReportEdition | null;
  /** Any date in the week the report covers. Without it, the filename's date or the arrival date decides. */
  weekOf?: string | null;
  /** When the report was sent, e.g. the email's date. */
  receivedAt?: Date | null;
};

export type IngestResult = { report: AreaReport; duplicate: boolean };

function pickReceivedAt(value: Date | null | undefined): Date {
  const now = new Date();
  if (!value || Number.isNaN(value.getTime())) return now;
  const ageDays = (now.getTime() - value.getTime()) / 86_400_000;
  // Ignore clocks that are wildly off rather than filing the report under the wrong week.
  return ageDays >= -1 && ageDays <= 30 ? value : now;
}

function cleanFilename(name: string | null, weekOf: string): string {
  const base = (name ?? "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^\w.\- ]+/g, "")
    .trim();
  return base && base.toLowerCase().endsWith(".pdf") ? base : `area-report-${weekOf}.pdf`;
}

export async function ingestReport(input: IngestInput): Promise<IngestResult> {
  const { bytes } = input;
  if (bytes.length === 0) throw new IngestError("The request had no file in it.", 400);
  if (bytes.length > MAX_PDF_BYTES) throw new IngestError("PDF is over the 4 MB limit.", 413);
  if (!isPdf(bytes)) throw new IngestError("That file is not a PDF.", 415);

  const sha256 = await sha256Hex(bytes);
  const existing = (await readState()).reports.find((r) => r.sha256 === sha256);
  if (existing) return { report: existing, duplicate: true };

  const receivedAt = pickReceivedAt(input.receivedAt);
  const weekOf = resolveWeekOf({
    explicit: input.weekOf,
    filename: input.filename,
    received: localDateTime(receivedAt, config.tz).date,
  });
  const id = crypto.randomUUID();

  // Upload before recording, so state never points at a file that is not there.
  await files.put(reportFileName(id), bytes, "application/pdf");

  const outcome = await updateState((state) => {
    const duplicate = state.reports.find((r) => r.sha256 === sha256);
    if (duplicate) return { report: duplicate, duplicate: true, dropped: [] as AreaReport[] };

    const report: AreaReport = {
      id,
      weekOf,
      edition: chooseEdition(state.reports, weekOf, input.edition),
      receivedAt: receivedAt.toISOString(),
      filename: cleanFilename(input.filename, weekOf),
      size: bytes.length,
      sha256,
      source: input.source,
      extraction: config.anthropicKey ? { status: "pending", startedAt: new Date().toISOString() } : { status: "off" },
    };
    const { kept, dropped } = pruneReports([report, ...state.reports]);
    state.reports = kept;
    return { report, duplicate: false, dropped };
  });

  const orphaned = outcome.duplicate ? [reportFileName(id)] : outcome.dropped.map((r) => reportFileName(r.id));
  if (orphaned.length) await files.delete(orphaned).catch(() => undefined);

  return { report: outcome.report, duplicate: outcome.duplicate };
}

async function readBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads events out of a stored report and records the result. Never throws. */
export async function runExtraction(reportId: string): Promise<void> {
  const setExtraction = (extraction: AreaReport["extraction"]) =>
    updateState((state) => {
      const report = state.reports.find((r) => r.id === reportId);
      if (report) report.extraction = extraction;
    });

  try {
    if (!config.anthropicKey) {
      await setExtraction({ status: "off" });
      return;
    }
    const report = (await readState()).reports.find((r) => r.id === reportId);
    if (!report) return;
    const file = await files.get(reportFileName(reportId));
    if (!file) throw new Error("The stored PDF is missing.");
    const { summary, events, days } = await extractEvents(await readBytes(file.stream), report.weekOf);
    await setExtraction({
      status: "done",
      summary,
      events,
      days,
      model: EXTRACTION_MODEL,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    await setExtraction({
      status: "failed",
      error: describeExtractionError(error),
      finishedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }
}
