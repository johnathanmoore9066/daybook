import type { AgendaItem } from "@/lib/agenda";
import type { Dashboard } from "@/lib/dashboard";
import { describeDay, formatTime, toMinutes } from "@/lib/dates";
import { BUSY_LABEL } from "@/lib/format";
import type { BusyLevel } from "@/lib/types";

const TAG = { shift: "Work", due: "Due", town: "Area" } as const;

function isPast(item: AgendaItem, nowMinutes: number): boolean {
  if (item.kind === "shift") {
    return item.end !== "close" && toMinutes(item.end) > toMinutes(item.time) && toMinutes(item.end) <= nowMinutes;
  }
  if (item.time === null) return false;
  const end = item.kind === "town" && item.endTime ? item.endTime : item.time;
  return toMinutes(end) < nowMinutes;
}

/** Rendered twice: in the date column on wide screens, and ahead of the outlook on phones. */
function Busy({ level, where }: { level: BusyLevel; where: "date" | "inline" }) {
  return (
    <span className={`busy busy-${level} busy-${where}`}>
      <span className="visually-hidden">Area traffic: </span>
      {BUSY_LABEL[level]}
    </span>
  );
}

function Item({ item }: { item: AgendaItem }) {
  switch (item.kind) {
    case "shift":
      return (
        <>
          <span className="item-title">
            {item.role ? `${item.role}, until` : "Until"} {item.end === "close" ? "close" : formatTime(item.end)}
          </span>
          {item.changed && <span className="item-detail">Changed from your usual hours</span>}
        </>
      );
    case "due":
      return (
        <>
          <span className="item-title">{item.item.title}</span>
          {item.item.course && <span className="item-detail">{item.item.course}</span>}
        </>
      );
    case "town":
      return (
        <>
          <span className="item-title">{item.title}</span>
          {item.venue && !item.title.includes(item.venue) && <span className="item-detail">{item.venue}</span>}
          {item.note && <span className="item-note">{item.note}</span>}
        </>
      );
  }
}

export function WeekAgenda({ d }: { d: Dashboard }) {
  const first = describeDay(d.agenda[0].date);
  const last = describeDay(d.agenda[d.agenda.length - 1].date);
  return (
    <section id="week" className="section" aria-labelledby="week-heading">
      <header className="section-head">
        <h2 id="week-heading">Next 7 days</h2>
        <span className="section-aside">
          {first.month} {first.day} to {first.month === last.month ? "" : `${last.month} `}
          {last.day}
        </span>
      </header>

      <ol className="agenda">
        {d.agenda.map((day) => {
          const info = describeDay(day.date);
          const isToday = day.date === d.today;
          return (
            <li key={day.date} className={`agenda-day${isToday ? " is-today" : ""}`}>
              <p className="agenda-date">
                <span className="agenda-dow">{isToday ? "Today" : info.dow}</span>
                <span className="agenda-num">{info.day}</span>
                {day.outlook?.level && <Busy level={day.outlook.level} where="date" />}
              </p>
              <div className="agenda-body">
                {day.closed && <p className="agenda-outlook agenda-closed">Restaurant closed</p>}
                {(day.outlook?.outlook || day.outlook?.level) && (
                  <p className="agenda-outlook">
                    {day.outlook.level && <Busy level={day.outlook.level} where="inline" />}
                    {day.outlook.outlook}
                  </p>
                )}
                {day.items.length === 0 ? (
                  !day.outlook?.outlook && !day.closed && <p className="agenda-empty">Nothing on the books</p>
                ) : (
                  <ul className="agenda-items">
                    {day.items.map((item) => (
                      <li
                        key={item.key}
                        className={`item item-${item.kind}${isToday && isPast(item, d.nowMinutes) ? " is-past" : ""}`}
                      >
                        <span className="item-time">
                          {item.time ? formatTime(item.time) : item.kind === "due" ? "any time" : "all day"}
                        </span>
                        <span className={`tag tag-${item.kind}`}>
                          {item.kind === "town" && item.eventKind === "tv" ? "TV" : TAG[item.kind]}
                        </span>
                        <span className="item-body">
                          <Item item={item} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
