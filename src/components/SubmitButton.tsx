"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string };

export function SubmitButton({ children, pendingLabel, disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
