import { deleteShift, restoreDay, takeDayOff } from "@/app/actions";
import type { Dashboard } from "@/lib/dashboard";
import { addDays, describeDay, formatShortDate, mondayOf } from "@/lib/dates";
import { count, formatHours, joinParts, shiftRange } from "@/lib/format";
import { rotationShift, rotationWeek, type ScheduledShift } from "@/lib/schedule";
import { ShiftForm } from "./ShiftForm";
import { SubmitButton } from "./SubmitButton";

type Row = { date: string; shift: ScheduledShift } | { date: string; offFrom: ScheduledShift };

function weekLabel(monday: string) {
  const start = describeDay(monday);
  const end = describeDay(addDays(monday, 5));
  const range =
    start.month === end.month
      ? `${start.month} ${start.day}–${end.day}`
      : `${start.month} ${start.day}–${end.month} ${end.day}`;
  return { name: rotationWeek(monday).name, range };
}

function dayLabel(date: string, today: string) {
  const d = describeDay(date);
  return date === today ? "Today" : `${d.dow} ${d.day}`;
}

export function WorkPanel({ d }: { d: Dashboard }) {
  const { hours, closes, count: shiftCount } = d.upcomingHours;
  const aside = joinParts([
    d.currentWeek,
    shiftCount ? `${formatHours(hours)} hrs in 7 days` : "no shifts in 7 days",
    closes > 0 && count(closes, "close"),
  ]);

  const rows: Row[] = [
    ...d.upcomingShifts.map((shift) => ({ date: shift.date, shift })),
    ...d.daysOff.flatMap((date) => {
      const usual = rotationShift(date);
      return usual ? [{ date, offFrom: usual }] : [];
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const weeks = new Map<string, Row[]>();
  for (const row of rows) {
    const monday = mondayOf(row.date);
    weeks.set(monday, [...(weeks.get(monday) ?? []), row]);
  }

  return (
    <section id="work" className="section" aria-labelledby="work-heading">
      <header className="section-head">
        <h2 id="work-heading">Work</h2>
        <span className="section-aside">{aside}</span>
      </header>

      {[...weeks.entries()].map(([monday, weekRows]) => {
        const label = weekLabel(monday);
        return (
          <div key={monday} className="shift-week">
            <h3 className="shift-week-head">
              {label.name} <span>{label.range}</span>
            </h3>
            <ul className="shift-list">
              {weekRows.map((row) =>
                "shift" in row ? (
                  <li key={row.shift.id} className={`shift${row.date === d.today ? " is-today" : ""}`}>
                    <span className="shift-day">{dayLabel(row.date, d.today)}</span>
                    <span className="shift-hours">{shiftRange(row.shift)}</span>
                    <span className="shift-role">
                      {row.shift.source === "manual" && <span className="shift-changed">Changed</span>}
                      {row.shift.role}
                    </span>
                    {row.shift.source === "manual" ? (
                      <form action={deleteShift}>
                        <input type="hidden" name="id" value={row.shift.id} />
                        <SubmitButton
                          className="icon-button"
                          aria-label={`Remove the change on ${formatShortDate(row.date)} and go back to the usual hours`}
                        >
                          ×
                        </SubmitButton>
                      </form>
                    ) : (
                      <form action={takeDayOff}>
                        <input type="hidden" name="date" value={row.date} />
                        <SubmitButton
                          className="text-button"
                          pendingLabel="Saving…"
                          aria-label={`Take ${formatShortDate(row.date)} off`}
                        >
                          Take off
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                ) : (
                  <li key={`off:${row.date}`} className="shift is-off">
                    <span className="shift-day">{dayLabel(row.date, d.today)}</span>
                    <span className="shift-hours">Off</span>
                    <span className="shift-role">usually {shiftRange(row.offFrom)}</span>
                    <form action={restoreDay}>
                      <input type="hidden" name="date" value={row.date} />
                      <SubmitButton
                        className="text-button"
                        pendingLabel="Saving…"
                        aria-label={`Put ${formatShortDate(row.date)} back on the schedule`}
                      >
                        Undo
                      </SubmitButton>
                    </form>
                  </li>
                ),
              )}
            </ul>
          </div>
        );
      })}

      <ShiftForm roles={d.roles} defaultDate={d.today} />
    </section>
  );
}
