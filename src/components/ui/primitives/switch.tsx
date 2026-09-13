import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Track is 36x20 with a 2px inset; the 16px thumb therefore travels exactly
 * `36 - 2*2 - 16 = 16px`. The travel is derived from the box, not guessed, so
 * the thumb cannot escape the track at any border width or in either theme.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-[var(--radius-pill)] border-2 border-transparent p-0",
        "transition-colors duration-150 ease-out outline-none",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong",
        "focus-visible:ring-[3px] focus-visible:ring-ring/45",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-surface shadow-[var(--shadow-token-sm)] ring-0",
          "transition-transform duration-150 ease-out",
          "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export { Switch };
