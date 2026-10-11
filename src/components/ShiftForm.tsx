"use client";

import { useActionState, useId } from "react";
import { addShift, type ShiftFormState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function ShiftForm({ roles, defaultDate }: { roles: string[]; defaultDate: string }) {
  const [state, action] = useActionState(addShift, {
    error: null,
    saved: 0,
    defaults: { date: defaultDate, start: "16:00", end: "21:00", untilClose: false, role: roles[0] ?? "" },
  } satisfies ShiftFormState);
  const id = useId();
  const f = state.defaults;

  return (
    <form
      action={action}
      className="entry"
      key={state.saved}
      aria-describedby={state.error ? `${id}-error` : undefined}
    >
      <p className="entry-title">Change a day</p>
      <p className="entry-note">
        Picked up a shift or swapped hours? A shift added here replaces your usual hours for that day.
      </p>
      <div className="field">
        <label htmlFor={`${id}-date`}>Date</label>
        <input id={`${id}-date`} name="date" type="date" required defaultValue={f.date} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-start`}>Start</label>
        <input id={`${id}-start`} name="start" type="time" required defaultValue={f.start} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-end`}>End</label>
        <input id={`${id}-end`} name="end" type="time" defaultValue={f.end} />
      </div>
      <div className="field field-check">
        <input id={`${id}-close`} name="untilClose" type="checkbox" defaultChecked={f.untilClose} />
        <label htmlFor={`${id}-close`}>Until close</label>
      </div>
      <div className="field">
        <label htmlFor={`${id}-role`}>
          Position <span className="optional">optional</span>
        </label>
        <input
          id={`${id}-role`}
          name="role"
          list={`${id}-roles`}
          maxLength={40}
          defaultValue={f.role}
          placeholder="Server"
          autoComplete="off"
        />
        <datalist id={`${id}-roles`}>
          {roles.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>
      <div className="entry-submit">
        <SubmitButton className="button" pendingLabel="Adding…">
          Save change
        </SubmitButton>
      </div>
      {state.saved > 0 && !state.error && (
        <p className="form-ok" role="status">
          Saved. It replaces your usual hours that day.
        </p>
      )}
      {state.error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
