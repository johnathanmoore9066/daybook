import Link from "next/link";
import { deleteReminder, toggleFeedItem, toggleReminder } from "@/app/actions";
import type { DueItem } from "@/lib/agenda";
import type { Dashboard } from "@/lib/dashboard";
import { addDays } from "@/lib/dates";
import { count, dueWhen } from "@/lib/format";
import { ReminderForm } from "./ReminderForm";
import { SubmitButton } from "./SubmitButton";

function DueRow({ item, today }: { item: DueItem; today: string }) {
  const overdue = !item.done && item.source === "manual" && item.due < today;
  return (
    <li className={`due${item.done ? " is-done" : ""}${overdue ? " is-overdue" : ""}`}>
      <form action={item.source === "manual" ? toggleReminder : toggleFeedItem}>
        <input type="hidden" name="id" value={item.id} />
        <SubmitButton
          className="check"
          aria-pressed={item.done}
          aria-label={item.done ? `Mark not done: ${item.title}` : `Mark done: ${item.title}`}
        />
      </form>
      <div className="due-body">
        <p className="due-title">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </p>
        <p className="due-meta">
          <span className="due-when">{dueWhen(item.due, item.time, today)}</span>
          {item.course && <span>{item.course}</span>}
          {item.source === "feed" && <span className="due-source">from feed</span>}
        </p>
      </div>
      {item.source === "manual" && (
        <form action={deleteReminder}>
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton className="icon-button" aria-label={`Delete reminder: ${item.title}`}>
            ×
          </SubmitButton>
        </form>
      )}
    </li>
  );
}

const SHOWN = 10;

export function SchoolPanel({ d }: { d: Dashboard }) {
  const open = d.due.filter((i) => !i.done);
  const done = d.due.filter((i) => i.done && i.source === "manual");
  const shown = open.slice(0, SHOWN);
  const more = open.slice(SHOWN);
  const weekCount = d.dueSummary.nextSevenDays.length;

  return (
    <section id="school" className="section" aria-labelledby="school-heading">
      <header className="section-head">
        <h2 id="school-heading">School</h2>
        <span className="section-aside">{weekCount ? `${weekCount} due in 7 days` : "Nothing due in 7 days"}</span>
      </header>

      {open.length === 0 ? (
        <p className="empty">
          Nothing due. Add reminders below{d.feed.status === "off" ? " or connect your class calendar" : ""}.
        </p>
      ) : (
        <ul className="due-list">
          {shown.map((item) => (
            <DueRow key={`${item.source}:${item.id}`} item={item} today={d.today} />
          ))}
        </ul>
      )}

      {more.length > 0 && (
        <details className="more">
          <summary>{count(more.length, "more item")} further out</summary>
          <ul className="due-list">
            {more.map((item) => (
              <DueRow key={`${item.source}:${item.id}`} item={item} today={d.today} />
            ))}
          </ul>
        </details>
      )}

      {done.length > 0 && (
        <details className="more">
          <summary>Done ({done.length})</summary>
          <ul className="due-list">
            {done.map((item) => (
              <DueRow key={item.id} item={item} today={d.today} />
            ))}
          </ul>
        </details>
      )}

      <p className="note feed-status">
        {d.feed.status === "ok" && `Class calendar connected, ${count(d.feed.items.length, "item")} in range.`}
        {d.feed.status === "error" && <span className="is-alert">Class calendar: {d.feed.message}</span>}
        {d.feed.status === "off" && (
          <>
            No class calendar connected. <Link href="/setup#school-feed">Add your Canvas or Blackboard feed</Link>
          </>
        )}
      </p>

      <ReminderForm courses={d.courses} defaultDue={addDays(d.today, 1)} />
    </section>
  );
}
