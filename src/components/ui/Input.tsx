import * as React from "react";

import { cn } from "@/lib/utils";
import { Input as InputPrimitive } from "./primitives/input";
import { Label } from "./primitives/label";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Class for the wrapping field, when the field itself needs to be sized. */
  fieldClassName?: string;
}

/**
 * A labelled text field: shadcn's `Input` and `Label` wired into one
 * accessible unit (`htmlFor`, `aria-invalid`, `aria-describedby`) so no screen
 * has to reassemble that plumbing.
 *
 * `className` still lands on the `<input>`, as it did before this file moved
 * to shadcn, so existing call sites keep working; `fieldClassName` is the new
 * escape hatch for sizing the wrapper.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, hint, error, className, fieldClassName, id, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className={cn("flex flex-col gap-1.5", fieldClassName)}>
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <InputPrimitive
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={className}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-[12px] font-medium text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[12px] text-fg-subtle">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
