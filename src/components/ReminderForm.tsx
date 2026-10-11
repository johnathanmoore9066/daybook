"use client";

import { useActionState, useId } from "react";
import { addReminder, type ReminderFormState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

const initial: ReminderFormState = { error: null, saved: 0, defaults: { course: "" } };

export function ReminderForm({ courses, defaultDue }: { courses: string[]; defaultDue: string }) {
  const [state, action] = useActionState(addReminder, initial);
  const id = useId();
  return (
    <form
      action={action}
      className="entry"
      key={state.saved}
      aria-describedby={state.error ? `${id}-error` : undefined}
    >
      <p className="entry-title">Add a reminder</p>
      <div className="field field-wide">
        <label htmlFor={`${id}-title`}>What&apos;s due</label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={140}
          placeholder="Lab 6 write-up"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-course`}>Course</label>
        <input
          id={`${id}-course`}
          name="course"
          list={`${id}-courses`}
          maxLength={40}
          defaultValue={state.defaults.course}
          placeholder="BIOL 110"
          autoComplete="off"
        />
        <datalist id={`${id}-courses`}>
          {courses.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="field">
        <label htmlFor={`${id}-due`}>Due</label>
        <input id={`${id}-due`} name="due" type="date" required defaultValue={defaultDue} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-time`}>
          Time <span className="optional">optional</span>
        </label>
        <input id={`${id}-time`} name="time" type="time" />
      </div>
      <div className="entry-submit">
        <SubmitButton className="button" pendingLabel="Adding…">
          Add reminder
        </SubmitButton>
      </div>
      {state.error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
