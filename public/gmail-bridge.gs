/**
 * Daybook Gmail bridge
 *
 * Watches your Gmail for the weekly area report and posts the PDF to your Daybook dashboard.
 * It runs inside your own Google account on a 15-minute timer.
 *
 * Setup
 *  1. Open https://script.google.com, choose New project, paste this whole file over the
 *     sample code, and save. Name the project "Daybook bridge".
 *  2. Project Settings (gear icon) > Script properties > Add script property:
 *       DAYBOOK_URL    https://your-dashboard.vercel.app
 *       INGEST_TOKEN   the same value you set as INGEST_TOKEN in Vercel
 *  3. Edit SEARCH below so it matches only the agent's emails. The sender address is the
 *     most reliable filter, e.g. 'from:reports@youragent.com has:attachment filename:pdf'.
 *  4. Pick testConnection in the toolbar's function menu, click Run, and approve the
 *     permission prompt (Gmail read access and external requests). The log should say
 *     "Connected".
 *  5. Run installTrigger once. From then on the bridge checks every 15 minutes.
 *
 * Each email is sent once. The dashboard also ignores a PDF it already has, so a report never
 * shows up twice, and a follow-up for the same week is filed as that week's update.
 */

const SEARCH = 'has:attachment filename:pdf subject:(area OR events) newer_than:10d';

function settings_() {
  const props = PropertiesService.getScriptProperties();
  const url = (props.getProperty('DAYBOOK_URL') || '').replace(/\/+$/, '');
  const token = props.getProperty('INGEST_TOKEN');
  if (!url || !token) throw new Error('Add DAYBOOK_URL and INGEST_TOKEN under Project Settings > Script properties.');
  return { props: props, endpoint: url + '/api/ingest/area-report', token: token };
}

function forwardAreaReports() {
  const s = settings_();
  const sent = JSON.parse(s.props.getProperty('SENT_IDS') || '[]');

  GmailApp.search(SEARCH, 0, 20).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const id = message.getId();
      if (sent.indexOf(id) !== -1) return;

      const pdfs = message.getAttachments().filter(function (a) {
        return a.getContentType() === 'application/pdf' || /\.pdf$/i.test(a.getName());
      });

      let delivered = true;
      pdfs.forEach(function (pdf) {
        const url =
          s.endpoint +
          '?source=email' +
          '&receivedAt=' + encodeURIComponent(message.getDate().toISOString()) +
          '&filename=' + encodeURIComponent(pdf.getName());
        const res = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/pdf',
          payload: pdf.getBytes(),
          headers: { Authorization: 'Bearer ' + s.token },
          muteHttpExceptions: true,
        });
        const code = res.getResponseCode();
        if (code === 200 || code === 201) {
          console.log('Sent ' + pdf.getName() + ': ' + res.getContentText());
        } else {
          delivered = false;
          console.error('Dashboard refused ' + pdf.getName() + ' (' + code + '): ' + res.getContentText());
        }
      });

      // Failed deliveries stay unmarked so the next run retries them.
      if (delivered) sent.push(id);
    });
  });

  s.props.setProperty('SENT_IDS', JSON.stringify(sent.slice(-200)));
}

function testConnection() {
  const s = settings_();
  const res = UrlFetchApp.fetch(s.endpoint, {
    method: 'post',
    contentType: 'application/pdf',
    payload: '',
    headers: { Authorization: 'Bearer ' + s.token },
    muteHttpExceptions: true,
  });
  // An empty body gets past the token check and is then rejected as "no file", which proves the token works.
  const code = res.getResponseCode();
  if (code === 400) console.log('Connected. The dashboard accepted the token.');
  else console.error('Not connected (' + code + '): ' + res.getContentText());

  const matches = GmailApp.search(SEARCH, 0, 5);
  console.log('SEARCH matches ' + matches.length + ' recent thread(s).');
  matches.forEach(function (t) {
    console.log('  ' + t.getFirstMessageSubject());
  });
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'forwardAreaReports') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('forwardAreaReports').timeBased().everyMinutes(15).create();
  console.log('Installed. Gmail is checked every 15 minutes.');
}
