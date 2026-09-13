import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonBase } from "./primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./primitives/tooltip";

/**
 * A square, icon-only button.
 *
 * `label` is mandatory and always reaches the accessibility tree via
 * `aria-label`. It is also shown as a real Radix tooltip rather than the
 * browser's `title` bubble — `title` renders in the OS chrome with the OS
 * font, which is the cheapest visual tell that a UI was assembled rather than
 * designed, and it never appears for keyboard or touch users at all.
 *
 * Redesign notes:
 * - `default` is now **borderless**, matching the reference's `ghost`
 *   icon buttons in its top bar. A bordered square next to a 24px card reads
 *   as a leftover form control. `outline` keeps the old bordered look for the
 *   places that genuinely need a visible affordance (table row actions).
 * - `active` (the `active` *prop*, not a variant) is the client-mandated
 *   brown fill for a toggle that is currently on. It applies to every
 *   variant through `compoundVariants` so no call site has to know which
 *   brown to use.
 * - `nav` and `footer` are deprecated aliases of `default`; the surfaces they
 *   were tuned for were retired with the coffee palette. See `tokens.css`.
 */
const iconButtonVariants = cva(buttonBase, {
  variants: {
    variant: {
      default: "text-fg-muted hover:bg-surface-hover hover:text-fg",
      outline:
        "border border-input bg-surface-raised text-fg-muted hover:border-border-strong hover:bg-surface-hover hover:text-fg",
      accent:
        "bg-primary text-primary-foreground shadow-[var(--shadow-token-sm)] hover:bg-accent-strong",
      danger:
        "border border-danger/35 bg-danger-soft text-danger hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive/35",
      /** @deprecated Alias of `default`; the kraft rail no longer exists. */
      nav: "text-fg-muted hover:bg-surface-hover hover:text-fg",
      /** @deprecated Alias of `default`; the black footer no longer exists. */
      footer: "text-fg-muted hover:bg-surface-hover hover:text-fg",
    },
    size: {
      sm: "size-9",
      md: "size-10",
    },
    /** Pressed/selected state — a toggle that is currently on. */
    active: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    // CLIENT OVERRIDE: every "this control is currently on" state is brown
    // with white glyph, regardless of the variant it started from.
    {
      active: true,
      variant: "default",
      className: "bg-active text-active-fg hover:bg-active-hover hover:text-active-fg",
    },
    {
      active: true,
      variant: "outline",
      className:
        "border-transparent bg-active text-active-fg hover:bg-active-hover hover:text-active-fg",
    },
    {
      active: true,
      variant: "nav",
      className: "bg-active text-active-fg hover:bg-active-hover hover:text-active-fg",
    },
    {
      active: true,
      variant: "footer",
      className: "bg-active text-active-fg hover:bg-active-hover hover:text-active-fg",
    },
  ],
  defaultVariants: {
    variant: "default",
    size: "md",
    active: false,
  },
});

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof iconButtonVariants> {
  icon: React.ReactNode;
  /** Accessible name. Also the tooltip copy. */
  label: string;
  /** Set false for a control whose meaning is already obvious from context. */
  tooltip?: boolean;
  asChild?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      className,
      variant,
      size,
      active,
      tooltip = true,
      asChild = false,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    const button = (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        aria-label={label}
        aria-pressed={active ? true : undefined}
        data-slot="icon-button"
        className={cn(iconButtonVariants({ variant, size, active }), className)}
        {...props}
      >
        {icon}
      </Comp>
    );

    if (!tooltip) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  },
);

export { iconButtonVariants };
