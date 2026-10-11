import Link from "next/link";
import { retryExtraction } from "@/app/actions";
import { config } from "@/lib/config";
import type { Dashboard } from "@/lib/dashboard";
import { describeDay } from "@/lib/dates";
import { count, formatReceived } from "@/lib/format";
import type { AreaReport } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

export function EditionBadge({ report }: { report: AreaReport }) {
  return report.edition === "update" ? (
    <span className="badge badge-update">Update</span>
  ) : (
    <span className="badge">Weekly report</span>
  );
}

export function ExtractionNote({ report }: { report: AreaReport }) {
  const x = report.extraction;
  switch (x.status) {
    case "done":
      return null;
    case "pending":
      return <p className="note">Pulling the events out of this PDF. They show up in your week within a minute.</p>;
    case "off":
      return (
        <p className="note">
          Events from the PDF aren&apos;t listed in your week because no Claude API key is set.{" "}
          <Link href="/setup">Setup</Link>
        </p>
      );
    case "failed":
      return (
        <div className="note note-alert">
          <p>Couldn&apos;t list this report&apos;s events: {x.error} The PDF itself is fine.</p>
          {config.anthropicKey && (
            <form action={retryExtraction}>
              <input type="hidden" name="id" value={report.id} />
              <SubmitButton className="button button-small" pendingLabel="Retrying…">
                Try again
              </SubmitButton>
            </form>
          )}
        </div>
      );
  }
}

export function AreaPanel({ d }: { d: Dashboard }) {
  const current = d.report;
  const week = current ? describeDay(current.report.weekOf) : null;

  return (
    <section id="area" className="section" aria-labelledby="area-heading">
      <header className="section-head">
        <h2 id="area-heading">Area report</h2>
        {week && (
          <span className="section-aside">
            Week of {week.month} {week.day}
          </span>
        )}
      </header>

      {!current ? (
        <div className="empty">
          <p>No reports yet.</p>
          <p className="note">
            The weekly report lands here on its own once your agent or the Gmail bridge is pointed at this dashboard.{" "}
            <Link href="/setup">Connect it</Link>
          </p>
        </div>
      ) : (
        <>
          {current.timing === "stale" && (
            <p className="note note-alert">This week&apos;s report hasn&apos;t arrived. Showing the most recent one.</p>
          )}
          {current.timing === "upcoming" && <p className="note">This one arrived early for the coming week.</p>}
          <p className="edition-line">
            <EditionBadge report={current.report} />
            <span>
              Received {formatReceived(current.report.receivedAt, config.tz)}
              {current.replaces && ", replacing the earlier report"}
            </span>
          </p>
          {current.report.extraction.status === "done" && (
            <>
              {current.report.extraction.summary && <p className="area-summary">{current.report.extraction.summary}</p>}
              <p className="note">{count(current.report.extraction.events.length, "dated item")} in the report.</p>
            </>
          )}
          <ExtractionNote report={current.report} />
          {current.upcoming && (
            <p className="note">
              Next week&apos;s report is already in.{" "}
              <a href={`/api/reports/${current.upcoming.id}`} target="_blank" rel="noopener">
                Open it
              </a>
            </p>
          )}
          <p className="actions">
            <a className="button" href={`/api/reports/${current.report.id}`} target="_blank" rel="noopener">
              Open PDF
            </a>
            <Link className="button button-quiet" href="/area">
              All reports
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
