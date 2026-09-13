import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonBase } from "./primitives/button";

/**
 * The app's button.
 *
 * Same machinery as the canonical shadcn button in `./primitives/button`
 * (CVA, Radix `Slot` for `asChild`, the shared `buttonBase` geometry, focus
 * ring and transition timing) expressed in this project's own variant
 * vocabulary, which every screen already uses.
 *
 * Redesign notes:
 * - The geometry moved to a 16px radius and 40/36px heights, matching the
 *   reference's `rounded-2xl` buttons and staying finger-sized on a tablet.
 * - `secondary` lost its resting shadow. The reference's quiet button is a
 *   plain outlined chip; a drop shadow under a 16px radius reads as grime
 *   rather than lift at this scale.
 * - **`active` is new** and is the client-mandated brown/white treatment for
 *   a button that represents the currently-chosen option (a filter that is
 *   on, a segmented control's selected segment). Do not reach for `primary`
 *   to mean "selected" — `primary` means "this is the main action here", and
 *   conflating them is exactly what the override exists to prevent.
 * - `nav` and `footer` are **deprecated aliases**. They existed because the
 *   old system had a kraft sidebar rail and a black footer strip that did not
 *   follow the light/dark toggle; both surfaces were retired with the coffee
 *   identity (see the history note in `tokens.css`). They now resolve to
 *   `ghost` so no call site broke in the same pass as the palette swap —
 *   new code should write `ghost`.
 */
const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      /** The main action on the screen: the indigo brand fill. */
      primary:
        "bg-primary text-primary-foreground shadow-[var(--shadow-token-sm)] hover:bg-accent-strong",
      /** The default, quiet action — an outlined chip on the surface. */
      secondary:
        "border border-input bg-surface-raised text-fg hover:border-border-strong hover:bg-surface-hover",
      ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
      /** CLIENT OVERRIDE: currently-selected option. Brown fill, white text. */
      active: "bg-active text-active-fg shadow-[var(--shadow-token-sm)] hover:bg-active-hover",
      danger:
        "bg-destructive text-destructive-foreground shadow-[var(--shadow-token-sm)] hover:bg-destructive-strong focus-visible:ring-destructive/35",
      /** @deprecated Alias of `ghost`; the kraft rail no longer exists. */
      nav: "text-fg-muted hover:bg-surface-hover hover:text-fg",
      /** @deprecated Alias of `ghost`; the black footer no longer exists. */
      footer: "text-fg-muted hover:bg-surface-hover hover:text-fg",
    },
    size: {
      sm: "h-9 gap-1.5 px-3.5 text-[13px]",
      md: "h-10 px-4",
      lg: "h-11 px-6",
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "md",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child element (a router `<Link>`, say) instead of `<button>`. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, asChild = false, ...props }, ref) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

export { buttonVariants };
