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
          // 16px radius + 40px height, matching the reference's `rounded-2xl`
          // inputs. The extra 4px of height is not cosmetic: this app is used
          // with a finger on a tablet, and 40px is the smallest comfortable
          // touch target for a text field.
          "flex h-10 w-full min-w-0 rounded-[var(--radius-md)] border border-input bg-surface px-3.5 py-1 text-sm text-fg shadow-[var(--shadow-token-sm)]",
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
