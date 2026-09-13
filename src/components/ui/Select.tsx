import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/** Same visual language as `Input` — reach for this instead of a bare `<select>`. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium text-fg-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          className={cn(
            "h-9 w-full appearance-none rounded-[var(--radius-sm)] border bg-surface px-3 pr-8 text-sm text-fg outline-none",
            "transition-colors duration-150",
            error ? "border-danger focus:border-danger" : "border-border focus:border-accent",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <CaretDown
          size={14}
          weight="bold"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
      </div>
      {error ? (
        <p id={`${selectId}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-[12px] text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
