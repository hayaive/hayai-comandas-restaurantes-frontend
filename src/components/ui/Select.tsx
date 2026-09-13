import * as React from "react";
import { CaretDown } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Label } from "./primitives/label";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
}

/**
 * A labelled select, styled to sit flush with `Input` — identical height,
 * border, focus ring and disabled treatment, all drawn from the same shadcn
 * recipe.
 *
 * This one keeps a native `<select>` rather than moving to Radix, on purpose.
 * The app runs mostly on tablets and phones at a host stand, where a native
 * select opens the OS picker — a large, thumb-sized wheel or sheet that beats
 * any popup we could draw under service pressure. The trigger, which is the
 * part actually visible on screen, is styled here; the platform only owns the
 * opened list. `./primitives/select` holds the full Radix version for cases
 * that need rich option content (icons, descriptions, groups).
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, hint, error, className, fieldClassName, id, children, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;

    return (
      <div className={cn("flex flex-col gap-1.5", fieldClassName)}>
        {label && <Label htmlFor={selectId}>{label}</Label>}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={cn(
              "flex h-9 w-full appearance-none rounded-[var(--radius-sm)] border border-input bg-surface py-1 pl-3 pr-9 text-sm text-fg shadow-[var(--shadow-token-sm)]",
              "transition-[color,box-shadow,border-color] duration-150 outline-none",
              "hover:border-border-strong",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <CaretDown
            size={14}
            weight="bold"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
        </div>
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
