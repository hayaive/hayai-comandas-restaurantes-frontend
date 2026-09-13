import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full min-w-0 rounded-[var(--radius-sm)] border border-input bg-surface px-3 py-1 text-sm text-fg shadow-[var(--shadow-token-sm)]",
          "transition-[color,box-shadow,border-color] duration-150 outline-none",
          "placeholder:text-fg-subtle selection:bg-primary selection:text-primary-foreground",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
          className,
        )}
        {...props}
      />
    );
  },
);

export { Input };
