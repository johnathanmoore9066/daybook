"use client";

import { useActionState, useId } from "react";
import { uploadReport, type UploadState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function UploadForm() {
  const [state, action] = useActionState<UploadState, FormData>(uploadReport, { error: null, message: null });
  const id = useId();
  return (
    <form action={action} className="entry">
      <div className="field field-wide">
        <label htmlFor={`${id}-file`}>Area report PDF</label>
        <input id={`${id}-file`} name="file" type="file" accept="application/pdf,.pdf" required />
      </div>
      <div className="field">
        <label htmlFor={`${id}-week`}>
          Week it covers <span className="optional">optional</span>
        </label>
        <input id={`${id}-week`} name="weekOf" type="date" />
      </div>
      <div className="field">
        <label htmlFor={`${id}-edition`}>Edition</label>
        <select id={`${id}-edition`} name="edition" defaultValue="">
          <option value="">Work it out</option>
          <option value="original">Weekly report</option>
          <option value="update">Update to that week</option>
        </select>
      </div>
      <div className="entry-submit">
        <SubmitButton className="button" pendingLabel="Uploading…">
          Upload
        </SubmitButton>
      </div>
      {state.message && (
        <p className="form-ok" role="status">
          {state.message}
        </p>
      )}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
