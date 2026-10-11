# Daybook

A personal dashboard for one person: work shifts, school deadlines, and the weekly Columbia-area event report, merged into a single seven-day agenda. Built with Next.js 16 for Vercel. Works on a phone and a laptop.

## What it does

- Today and the next 7 days. Shifts, due dates, and area events in one list, in clock order, with the report's busyness rating (Quiet to Very high) beside each day.
- Area report. The agent's PDF arrives by HTTP request or through a Gmail bridge. The first PDF for a week is the weekly report; a later one for the same week is its update and takes its place. If `ANTHROPIC_API_KEY` is set, Claude Haiku lists the report's events and day ratings so they show up in the agenda. The PDF is always kept and viewable either way.
- School. Hand-entered reminders, plus an optional Canvas, Blackboard, or D2L calendar feed. Feed items can be checked off.
- Work. The standing two-week rotation is built in, so shifts appear on their own for any date. Sundays show as closed, and the report's traffic forecast for Sundays is hidden. One-off changes go through the dashboard: "Take off" skips a day, and a shift added for a date replaces that day's usual hours.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

With no Blob token, data is stored in `.data/` in the project folder. With no `DASHBOARD_PASSWORD`, the login screen is skipped locally.

```bash
npm test
```

## Deploy to Vercel

1. Push this folder to a GitHub repository and import it in Vercel.
2. In the Vercel project, open **Storage**, create a **Blob** store with access set to **Private**, and connect it. That sets `BLOB_READ_WRITE_TOKEN`.
3. Under **Settings > Environment Variables**, set `DASHBOARD_PASSWORD`, `SESSION_SECRET`, and `INGEST_TOKEN`. Add `ANTHROPIC_API_KEY` and `SCHOOL_ICS_URL` if you want them. See `.env.example`.
4. Redeploy, sign in, and open **Setup** to check that every row is filled in.

GitHub Pages can't host this: automatic delivery needs a server endpoint and private storage, and Pages only serves static files.

## Getting the area report in automatically

The endpoint is `POST /api/ingest/area-report` with `Authorization: Bearer <INGEST_TOKEN>`. It accepts the raw PDF or a multipart upload with a `file` field.

- The agent sends it directly. Paste the step in [integrations/agent-delivery.md](integrations/agent-delivery.md) into the agent's report skill.
- Forward it from Gmail. If the report arrives by email, [public/gmail-bridge.gs](public/gmail-bridge.gs) is a Google Apps Script that checks Gmail every 15 minutes and posts new PDFs. Setup steps are at the top of the file and on the dashboard's Setup page.

The week a report covers comes from, in order: a `weekOf` field, a `YYYY-MM-DD` date in the filename, or the day it arrived. Sending the same PDF twice does nothing. The last 30 reports are kept.

## Changing the standing schedule

The rotation lives in [src/lib/schedule.ts](src/lib/schedule.ts): the hours for each of the two weeks, and `ROTATION_ANCHOR`, a Monday that starts the first week listed. If the pattern changes, edit that file and redeploy. The tests in `schedule.test.ts` pin the current pattern, so update them alongside it.

## Layout

- `src/lib/`: date math, calendar feed parsing, agenda merging, report rules, storage, and the Claude call. Unit tests sit next to the code.
- `src/app/`: pages (`/`, `/area`, `/setup`, `/login`), Server Actions, and the ingest and PDF routes.
- `src/proxy.ts`: the login gate. The ingest route is excluded and checks its own token.
