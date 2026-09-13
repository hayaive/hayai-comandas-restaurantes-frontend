import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Canonical shadcn/ui button.
 *
 * Two deviations from upstream, both deliberate:
 * - hover darkens with the real `--accent-strong` indigo instead of
 *   `bg-primary/90`. The `/90` form is `color-mix(…, transparent)`, so on a
 *   light background it makes the button *lighter* on hover, which reads as
 *   the button losing weight under the cursor.
 * - shadows use the `--shadow-token-*` scale rather than Tailwind's
 *   `shadow-xs`, so elevation stays in step with the theme.
 */
/**
 * The shared button base. Exported (a small deviation from upstream shadcn,
 * which inlines it) so `ui/Button.tsx` and `ui/IconButton.tsx` can express
 * this project's own variant vocabulary on exactly the same geometry, focus
 * ring and transition timing instead of drifting into a second, near-identical
 * base string.
 *
 * Geometry note: the radius is `--radius-md` (16px), matching the reference's
 * `rounded-2xl` buttons. At that radius a 36-40px control is visibly softened
 * without becoming a pill, which is the distinction the reference draws
 * between a button and a filter chip.
 */
export const buttonBase = [
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium",
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
  "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45",
  "disabled:pointer-events-none disabled:opacity-45",
  "active:scale-[0.985]",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
];

export const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      default:
        "bg-primary text-primary-foreground shadow-[var(--shadow-token-sm)] hover:bg-accent-strong",
      destructive:
        "bg-destructive text-destructive-foreground shadow-[var(--shadow-token-sm)] hover:bg-destructive-strong focus-visible:ring-destructive/35",
      outline:
        "border border-input bg-surface-raised text-fg shadow-[var(--shadow-token-sm)] hover:bg-surface-hover hover:border-border-strong",
      secondary: "bg-secondary text-secondary-foreground hover:bg-border",
      ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
      sm: "h-9 gap-1.5 px-3.5 text-[13px] has-[>svg]:px-3",
      lg: "h-11 px-6 has-[>svg]:px-5",
      icon: "size-10",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { Button };
