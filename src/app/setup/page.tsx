import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { Masthead } from "@/components/Masthead";
import { UploadForm } from "@/components/UploadForm";
import { config, gateMode } from "@/lib/config";
import { EXTRACTION_MODEL } from "@/lib/extract";
import { storageKind } from "@/lib/store";

export const metadata: Metadata = { title: "Setup · Daybook" };

type Row = { label: string; ok: boolean; value: string; fix?: string };

async function SetupContent() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const endpoint = `${origin}/api/ingest/area-report`;

  const storage = storageKind();
  const gate = gateMode();
  const rows: Row[] = [
    {
      label: "Storage",
      ok: storage !== "missing",
      value:
        storage === "blob"
          ? `Vercel Blob (${config.blobAccess})`
          : storage === "local"
            ? "Local .data folder (dev only)"
            : "Not connected",
      fix: "Vercel > Storage > Create Blob store (Private) > Connect to this project.",
    },
    {
      label: "Login",
      ok: gate === "locked",
      value:
        gate === "locked"
          ? "Password required"
          : gate === "open"
            ? "Open (fine on your own machine)"
            : "Missing password",
      fix: "Set DASHBOARD_PASSWORD. Optionally set SESSION_SECRET so changing the password doesn't sign you out.",
    },
    {
      label: "Ingest token",
      ok: Boolean(config.ingestToken),
      value: config.ingestToken ? "Set" : "Not set, so nothing can post reports",
      fix: "Set INGEST_TOKEN to a long random string. The agent or Gmail bridge sends the same value.",
    },
    {
      label: "Event listing",
      ok: Boolean(config.anthropicKey),
      value: config.anthropicKey
        ? `On, read by ${EXTRACTION_MODEL}`
        : "Off. PDFs are stored but their events don't reach your week.",
      fix: "Set ANTHROPIC_API_KEY. Each report costs well under a cent to read.",
    },
    {
      label: "Class calendar",
      ok: Boolean(config.schoolFeedUrl),
      value: config.schoolFeedUrl ? "Connected" : "Not connected",
      fix: "Set SCHOOL_ICS_URL to your Canvas or Blackboard calendar feed (see below).",
    },
  ];

  return (
    <>
      <section className="section" aria-labelledby="status-heading">
        <header className="section-head">
          <h2 id="status-heading">Status</h2>
          <span className="section-aside">Time zone {config.tz}</span>
        </header>
        <dl className="status">
          {rows.map((r) => (
            <div key={r.label} className={r.ok ? "is-ok" : "is-missing"}>
              <dt>{r.label}</dt>
              <dd>
                <span className="status-value">{r.value}</span>
                {!r.ok && r.fix && <span className="status-fix">{r.fix}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section prose" aria-labelledby="ingest-heading">
        <header className="section-head">
          <h2 id="ingest-heading">Getting the area report here on its own</h2>
        </header>
        <p>
          Reports arrive at one address. Every request needs the ingest token in an <code>Authorization</code> header.
          The week a report covers comes from a date in its filename (like{" "}
          <code>columbia-event-report-2026-10-12.pdf</code>) or a <code>weekOf</code> field. The first PDF for a week is
          the weekly report; a later one for the same week is filed as its update. Sending the same PDF twice does
          nothing.
        </p>
        <pre className="code">
          <code>POST {endpoint}</code>
        </pre>

        <h3>Option 1: the agent posts the PDF itself</h3>
        <p>
          If the agent can make an HTTP request or run a shell command, add this as its last step. This is the most
          direct route.
        </p>
        <pre className="code">
          <code>
            {`curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer $INGEST_TOKEN" \\
  -H "Content-Type: application/pdf" \\
  --data-binary @area-report.pdf`}
          </code>
        </pre>
        <p className="note">
          Multipart uploads work too: send the PDF in a field named <code>file</code>. Add <code>?edition=update</code>{" "}
          to force a file to count as an update, or <code>?weekOf=2026-10-12</code> when the filename has no date.
        </p>

        <h3>Option 2: forward it from Gmail</h3>
        <p>
          If the agent emails you the PDF, a small Google Apps Script in your own account can pass it along every 15
          minutes. No third-party mail service is involved.
        </p>
        <ol>
          <li>
            <a href="/gmail-bridge.gs" download>
              Download gmail-bridge.gs
            </a>{" "}
            and open{" "}
            <a href="https://script.google.com" target="_blank" rel="noopener">
              script.google.com
            </a>
            .
          </li>
          <li>
            Create a project, paste the script in, and add two script properties:
            <code> DAYBOOK_URL</code> = <code>{origin}</code> and <code>INGEST_TOKEN</code> = your token.
          </li>
          <li>
            Change <code>SEARCH</code> at the top so it matches the agent&apos;s sender address.
          </li>
          <li>
            Run <code>testConnection</code>, approve access, then run <code>installTrigger</code> once.
          </li>
        </ol>
      </section>

      <section id="school-feed" className="section prose" aria-labelledby="feed-heading">
        <header className="section-head">
          <h2 id="feed-heading">Class calendar feed</h2>
        </header>
        <p>
          Assignment due dates can come straight from your school&apos;s calendar instead of being typed in. Copy the
          feed link and set it as <code>SCHOOL_ICS_URL</code>.
        </p>
        <ul>
          <li>Canvas: Calendar, then Calendar Feed in the right sidebar.</li>
          <li>Blackboard: Calendar, then the settings gear, then Share Calendar or Get external calendar link.</li>
          <li>D2L Brightspace: Calendar, then Subscribe.</li>
        </ul>
        <p className="note">
          The feed link works like a password for your calendar, so keep it in Vercel rather than in the code.
        </p>
      </section>

      <section className="section" aria-labelledby="upload-heading">
        <header className="section-head">
          <h2 id="upload-heading">Upload a report by hand</h2>
        </header>
        <p className="note">For a week when the automatic route misses, or to load an older report.</p>
        <UploadForm />
      </section>
    </>
  );
}

export default function SetupPage() {
  return (
    <>
      <Masthead page="setup" />
      <main className="page setup-page">
        <header className="page-head">
          <h1>Setup</h1>
          <p className="page-sub">Settings live in Vercel environment variables. Redeploy after changing one.</p>
        </header>
        <Suspense fallback={<Loading label="Checking connections" />}>
          <SetupContent />
        </Suspense>
      </main>
    </>
  );
}
