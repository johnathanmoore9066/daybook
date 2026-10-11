# Sending the area report to Daybook

Add the block below to the end of the agent's report skill. It needs two things from its environment:

- `DAYBOOK_URL`: the deployed dashboard, for example `https://daybook-silk.vercel.app`
- `DAYBOOK_INGEST_TOKEN`: the same value as `INGEST_TOKEN` in the Vercel project

Store the token as a secret in whatever runs the agent. Never paste it into the skill text or into this file: the repository is public, and anyone holding the token can post to the dashboard.

If the agent runs in a sandbox with an outbound network allowlist, add the dashboard's domain to it.

---

## Deliver the report to Daybook

After the PDF is saved, send it to the dashboard with one HTTP request.

1. Name the file `columbia-event-report-<YYYY-MM-DD>.pdf`, where the date is the Monday of the week the report covers. The dashboard files the report under that week, even when it is prepared days earlier.
2. POST the raw PDF:

   ```bash
   curl -fsS -X POST "${DAYBOOK_URL%/}/api/ingest/area-report?filename=columbia-event-report-2026-10-12.pdf" \
     -H "Authorization: Bearer $DAYBOOK_INGEST_TOKEN" \
     -H "Content-Type: application/pdf" \
     --data-binary @columbia-event-report-2026-10-12.pdf
   ```

   Without a shell, the same request in Python's standard library:

   ```python
   import os, urllib.request

   name = "columbia-event-report-2026-10-12.pdf"
   req = urllib.request.Request(
       f"{os.environ['DAYBOOK_URL'].rstrip('/')}/api/ingest/area-report?filename={name}",
       data=open(name, "rb").read(),
       method="POST",
       headers={
           "Authorization": f"Bearer {os.environ['DAYBOOK_INGEST_TOKEN']}",
           "Content-Type": "application/pdf",
       },
   )
   print(urllib.request.urlopen(req, timeout=30).read().decode())
   ```

3. Read the response:
   - `201`: delivered. The JSON says which week it was filed under and whether it is the weekly report or an update.
   - `200` with `"duplicate": true`: that exact PDF was already delivered. Nothing to do.
   - `401`: the token is wrong. Stop and report it.
   - `413` or `415`: the file is over 4 MB or is not a PDF. Stop and report it.
   - `5xx` or a network error: wait a minute and retry, up to three times.

For the Thursday follow-up, send the revised PDF the same way with the same Monday date in its name. The dashboard files it as that week's update and shows it in place of the original, which stays available.
