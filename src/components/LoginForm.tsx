"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <form action={action} className="login-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-describedby={state.error ? "login-error" : undefined}
      />
      <SubmitButton className="button" pendingLabel="Checking…">
        Open
      </SubmitButton>
      {state.error && (
        <p id="login-error" className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
