import Link from "next/link";
import type { Dashboard } from "@/lib/dashboard";
import { describeDay, formatTime, relativeDay, toMinutes } from "@/lib/dates";
import { count, joinParts, shiftRange } from "@/lib/format";

function leadLine(d: Dashboard): string {
  const shift = d.nextShift?.date === d.today ? d.nextShift : null;
  if (!shift) return d.closedToday ? "Closed today." : "Off today.";
  const until = shift.end === "close" ? "close" : formatTime(shift.end);
  if (d.nowMinutes >= toMinutes(shift.start)) return `On shift until ${until}.`;
  return shift.end === "close" ? `Working ${formatTime(shift.start)} to close.` : `Working ${shiftRange(shift)}.`;
}

export function TodayBlock({ d }: { d: Dashboard }) {
  const day = describeDay(d.today);
  const todayShift = d.nextShift?.date === d.today ? d.nextShift : null;
  const following = d.upcomingShifts.find((s) => s.date > d.today) ?? null;
  const { overdue, today, nextSevenDays } = d.dueSummary;
  const schoolLine = joinParts([
    overdue.length > 0 && `${overdue.length} overdue`,
    today.length > 0 && `${today.length} due today`,
    nextSevenDays.length > 0 && `${nextSevenDays.length} due in the next 7 days`,
  ]);
  const report = d.report;
  const eventCount = d.agenda.reduce((n, day) => n + day.items.filter((i) => i.kind === "town").length, 0);

  return (
    <section className="today" aria-labelledby="today-heading">
      <h1 id="today-heading" className="tearoff">
        <span className="tearoff-month">{day.month}</span>
        <span className="tearoff-day">{day.day}</span>
        <span className="tearoff-dow">{day.dowLong}</span>
      </h1>

      <div className="today-lines">
        <p className="today-lead">{leadLine(d)}</p>
        <dl className="today-facts">
          {todayShift?.role && (
            <div>
              <dt>Today</dt>
              <dd>
                {shiftRange(todayShift)}, {todayShift.role}
              </dd>
            </div>
          )}
          <div>
            <dt>Next shift</dt>
            <dd>
              {following ? (
                <>
                  {relativeDay(following.date, d.today)}, {shiftRange(following)}
                  {following.role ? ` · ${following.role}` : ""}
                </>
              ) : (
                <Link href="#work">None entered yet</Link>
              )}
            </dd>
          </div>
          <div>
            <dt>School</dt>
            <dd className={overdue.length ? "is-alert" : undefined}>
              {schoolLine || "Nothing due in the next 7 days"}
            </dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>
              {report && report.timing !== "stale" ? (
                <Link href="/area">
                  {report.timing === "upcoming"
                    ? "Next week's report is in"
                    : report.report.edition === "update"
                      ? "Updated report"
                      : "Weekly report"}
                  {report.report.extraction.status === "done" ? `, ${count(eventCount, "event")} ahead` : ""}
                </Link>
              ) : (
                "This week's report hasn't arrived"
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
