import { after } from "next/server";
import { bearerToken, secretsMatch } from "@/lib/auth";
import { config } from "@/lib/config";
import { IngestError, ingestReport, runExtraction } from "@/lib/ingest";
import { StorageNotConfiguredError } from "@/lib/store";
import type { ReportEdition, ReportSource } from "@/lib/types";

// Leaves room for the PDF read that runs after the response is sent.
export const maxDuration = 120;

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

function parseEdition(value: string | null): ReportEdition | null {
  if (value === "original" || value === "update") return value;
  return null;
}

function parseSource(value: string | null): ReportSource {
  return value === "email" || value === "upload" ? value : "agent";
}

/**
 * Accepts the weekly area report from the agent or the Gmail bridge.
 *
 *   POST /api/ingest/area-report
 *   Authorization: Bearer <INGEST_TOKEN>
 *
 * Body is either the raw PDF (Content-Type: application/pdf) or multipart/form-data with a
 * `file` field. Optional query or form fields:
 *   weekOf=<YYYY-MM-DD>      any date in the week covered; otherwise a date in the filename, then arrival
 *   edition=original|update  otherwise the first report for a week is the original
 *   source=agent|email, receivedAt=<ISO date>, filename=<name>
 */
export async function POST(request: Request) {
  if (!config.ingestToken) {
    return json(503, { error: "INGEST_TOKEN is not set on the server." });
  }
  const provided = bearerToken(request.headers.get("authorization")) ?? request.headers.get("x-ingest-token");
  if (!provided || !(await secretsMatch(provided, config.ingestToken))) {
    return json(401, { error: "Missing or wrong ingest token." });
  }

  const url = new URL(request.url);
  const field = (form: FormData | null, name: string) => {
    const fromForm = form?.get(name);
    return typeof fromForm === "string" ? fromForm : url.searchParams.get(name);
  };

  try {
    let bytes: Uint8Array;
    let filename: string | null;
    let form: FormData | null = null;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.startsWith("multipart/form-data")) {
      form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json(400, { error: "Multipart body needs a `file` field." });
      bytes = new Uint8Array(await file.arrayBuffer());
      filename = file.name;
    } else {
      bytes = new Uint8Array(await request.arrayBuffer());
      filename = url.searchParams.get("filename");
    }

    const receivedAt = field(form, "receivedAt");
    const { report, duplicate } = await ingestReport({
      bytes,
      filename: field(form, "filename") ?? filename,
      source: parseSource(field(form, "source")),
      edition: parseEdition(field(form, "edition")),
      weekOf: field(form, "weekOf"),
      receivedAt: receivedAt ? new Date(receivedAt) : null,
    });

    if (!duplicate && report.extraction.status === "pending") {
      after(() => runExtraction(report.id));
    }

    return json(duplicate ? 200 : 201, {
      id: report.id,
      duplicate,
      edition: report.edition,
      weekOf: report.weekOf,
      extraction: report.extraction.status,
    });
  } catch (error) {
    if (error instanceof IngestError) return json(error.status, { error: error.message });
    if (error instanceof StorageNotConfiguredError) return json(503, { error: error.message });
    throw error;
  }
}
