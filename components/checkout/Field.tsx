"use client";

import { cloneElement, isValidElement, type ReactElement } from "react";
import { cn } from "@/lib/utils";

/** Shared input treatment for every checkout form: dark fill, glass border, gold focus. */
export const checkoutInputClass =
  "h-12 rounded-xl border-glass-border bg-[#1A1A1A] text-sm transition-colors duration-300 placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:ring-primary/25 aria-[invalid=true]:border-rose/60 aria-[invalid=true]:focus-visible:ring-rose/25";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + inline error, so steps stay free of repetition. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  /**
   * Point the control at its message without every caller repeating it: the
   * hint (while valid) or the error becomes the input's `aria-describedby`.
   */
  const describedBy =
    error ? errorId : hint ? hintId : undefined;

  const control =
    describedBy && isValidElement(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": describedBy,
        })
      : children;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

/** Checkbox row used for consent / option toggles. */
export function CheckboxRow({
  id,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: React.ReactNode }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-glass-border bg-[#1A1A1A] accent-[var(--primary)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
