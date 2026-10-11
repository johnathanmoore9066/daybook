import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { deleteReport } from "@/app/actions";
import { EditionBadge, ExtractionNote } from "@/components/AreaPanel";
import { Loading } from "@/components/Loading";
import { Masthead } from "@/components/Masthead";
import { SetupNeeded } from "@/components/SetupNeeded";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { currentReport } from "@/lib/area";
import { config } from "@/lib/config";
import { describeDay, formatTime, todayIn } from "@/lib/dates";
import { BUSY_LABEL, formatBytes, formatReceived } from "@/lib/format";
import { isClosed } from "@/lib/schedule";
import { readState, StorageNotConfiguredError } from "@/lib/store";
import type { AreaReport, Extraction, State } from "@/lib/types";

export const metadata: Metadata = { title: "Area report · Daybook" };

const SOURCE = { agent: "from the agent", email: "via email", upload: "uploaded by hand" } as const;

/** Every date the report talks about, including quiet days that have a rating but no events. */
function reportDays(x: Extract<Extraction, { status: "done" }>) {
  const days = x.days ?? [];
  const dates = [...new Set([...x.events.map((e) => e.date), ...days.map((d) => d.date)])].sort();
  return dates.map((date) => ({
    date,
    // No traffic forecast for days the restaurant is closed.
    outlook: isClosed(date) ? null : (days.find((d) => d.date === date) ?? null),
    closed: isClosed(date),
    events: x.events.filter((e) => e.date === date).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
  }));
}

function groupByWeek(reports: AreaReport[]) {
  const map = new Map<string, AreaReport[]>();
  for (const r of [...reports].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))) {
    map.set(r.weekOf, [...(map.get(r.weekOf) ?? []), r]);
  }
  return [...map.entries()];
}

async function AreaContent() {
  await connection();
  let state: State;
  try {
    state = await readState();
  } catch (error) {
    if (!(error instanceof StorageNotConfiguredError)) throw error;
    return <SetupNeeded message={error.message} />;
  }

  const today = todayIn(config.tz);
  const current = currentReport(state.reports, today);
  const report = current?.report;
  const week = report ? describeDay(report.weekOf) : null;

  return (
    <>
      <header className="page-head">
        <h1>Area report</h1>
        {week && (
          <p className="page-sub">
            Week of {week.monthLong} {week.day}
          </p>
        )}
      </header>

      {!report ? (
        <section className="section">
          <p className="empty">
            Nothing has come in yet. <Link href="/setup">Connect the agent or the Gmail bridge</Link>, or upload a PDF
            by hand on the setup page.
          </p>
        </section>
      ) : (
        <div className="area-layout">
          <section className="section" aria-labelledby="events-heading">
            <header className="section-head">
              <h2 id="events-heading">What&apos;s on</h2>
              <EditionBadge report={report} />
            </header>
            <p className="note">
              Received {formatReceived(report.receivedAt, config.tz)} {SOURCE[report.source]}
              {current.replaces && (
                <>
                  . Replaces the{" "}
                  <a href={`/api/reports/${current.replaces.id}`} target="_blank" rel="noopener">
                    earlier report
                  </a>
                </>
              )}
              .
            </p>
            <ExtractionNote report={report} />
            {report.extraction.status === "done" && (
              <>
                {report.extraction.summary && <p className="area-summary">{report.extraction.summary}</p>}
                <ol className="event-days">
                  {reportDays(report.extraction).map(({ date, events, outlook, closed }) => {
                    const d = describeDay(date);
                    return (
                      <li key={date} className={date === today ? "is-today" : undefined}>
                        <h3>
                          {d.dowLong}{" "}
                          <span>
                            {d.month} {d.day}
                          </span>
                          {outlook?.level && (
                            <span className={`busy busy-${outlook.level}`}>{BUSY_LABEL[outlook.level]}</span>
                          )}
                          {closed && <span className="busy">Closed</span>}
                        </h3>
                        {outlook?.outlook && <p className="agenda-outlook">{outlook.outlook}</p>}
                        <ul>
                          {events.map((e, i) => (
                            <li key={i} className="event">
                              <span className="item-time">
                                {e.time ? formatTime(e.time) : "all day"}
                                {e.endTime && `–${formatTime(e.endTime)}`}
                              </span>
                              <span className="item-body">
                                <span className="item-title">{e.title}</span>
                                {e.venue && !e.title.includes(e.venue) && (
                                  <span className="item-detail">{e.venue}</span>
                                )}
                                {e.note && <span className="item-note">{e.note}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            <p className="actions">
              <a className="button" href={`/api/reports/${report.id}`} target="_blank" rel="noopener">
                Open PDF
              </a>
              <a className="button button-quiet" href={`/api/reports/${report.id}?download`}>
                Download
              </a>
            </p>
          </section>

          <section className="pdf-frame" aria-label="PDF preview">
            <object data={`/api/reports/${report.id}#view=FitH`} type="application/pdf" title={report.filename}>
              <p className="note">
                This browser won&apos;t show PDFs inline. <a href={`/api/reports/${report.id}`}>Open the PDF</a>.
              </p>
            </object>
          </section>
        </div>
      )}

      {state.reports.length > 0 && (
        <section className="section" aria-labelledby="history-heading">
          <header className="section-head">
            <h2 id="history-heading">Past reports</h2>
            <span className="section-aside">Keeps the last 30</span>
          </header>
          <ol className="history">
            {groupByWeek(state.reports).map(([weekOf, reports]) => {
              const w = describeDay(weekOf);
              return (
                <li key={weekOf}>
                  <h3>
                    Week of {w.month} {w.day}
                  </h3>
                  <ul>
                    {reports.map((r) => (
                      <li key={r.id} className="history-row">
                        <EditionBadge report={r} />
                        <a href={`/api/reports/${r.id}`} target="_blank" rel="noopener" className="history-file">
                          {r.filename}
                        </a>
                        <span className="history-meta">
                          {formatReceived(r.receivedAt, config.tz)} · {formatBytes(r.size)}
                        </span>
                        <form action={deleteReport}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmSubmit
                            className="icon-button"
                            aria-label={`Delete ${r.filename}`}
                            message={`Delete ${r.filename}? The PDF can't be recovered.`}
                          >
                            ×
                          </ConfirmSubmit>
                        </form>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </>
  );
}

export default function AreaPage() {
  return (
    <>
      <Masthead page="area" />
      <main className="page area-page">
        <Suspense fallback={<Loading label="Loading the area report" />}>
          <AreaContent />
        </Suspense>
      </main>
    </>
  );
}
