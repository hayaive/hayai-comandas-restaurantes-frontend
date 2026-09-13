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
 */
const iconButtonVariants = cva([...buttonBase, "border"], {
  variants: {
    variant: {
      default:
        "border-input bg-surface-raised text-fg-muted shadow-[var(--shadow-token-sm)] hover:border-border-strong hover:bg-surface-hover hover:text-fg",
      accent:
        "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-token-sm)] hover:bg-accent-strong",
      danger:
        "border-danger/35 bg-danger-soft text-danger hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive/35",
      nav: "border-transparent text-nav-fg-muted hover:bg-nav-bg-hover hover:text-nav-fg",
      footer:
        "border-transparent text-footer-fg-muted hover:bg-footer-bg-hover hover:text-footer-fg focus-visible:ring-footer-accent/55",
    },
    size: {
      sm: "size-8",
      md: "size-9",
    },
    /** Pressed/selected state — a toggle that is currently on. */
    active: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      variant: "default",
      active: true,
      className: "border-accent bg-accent-soft text-accent hover:bg-accent-soft",
    },
    {
      variant: "nav",
      active: true,
      className: "bg-accent-soft text-accent",
    },
    {
      variant: "footer",
      active: true,
      className: "bg-footer-bg-hover text-footer-accent",
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
