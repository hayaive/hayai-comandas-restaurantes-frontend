import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn's badge on this project's `tone` vocabulary.
 *
 * Shape follows the reference, which is worth spelling out because it is a
 * deliberate reversal: the previous system used full pills
 * (`--radius-pill`), the reference uses `rounded-xl` — a 12px rounded
 * rectangle. Against 24px cards and 16px buttons, a true pill is the one
 * shape that does not belong to the family; the soft rectangle sits in the
 * same geometric language as everything around it.
 *
 * The three table states (`free`/`reserved`/`occupied`) still deliberately do
 * not borrow the brand hue — a host reading the floor must never confuse
 * "this table is selected" with "this table is occupied" — and for the same
 * reason none of them borrows the brown either. Each tone carries a 1px
 * border in its own hue on top of the soft fill so it keeps an edge in dark
 * mode, where a soft fill alone goes flat.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-[var(--radius-sm)] border px-2.5 py-1 text-[12px] font-medium leading-none",
    "transition-colors duration-150",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-hover text-fg-muted",
        accent: "border-accent/25 bg-accent-soft text-accent",
        /** CLIENT OVERRIDE: this thing is the selected/active one. */
        active: "border-transparent bg-active text-active-fg",
        danger: "border-danger/30 bg-danger-soft text-danger",
        free: "border-status-free/30 bg-status-free-soft text-status-free-fg",
        reserved:
          "border-status-reserved/30 bg-status-reserved-soft text-status-reserved-fg",
        occupied:
          "border-status-occupied/30 bg-status-occupied-soft text-status-occupied-fg",
        /** For a badge sitting on a gradient hero banner. */
        onHero: "border-transparent bg-white/20 text-white",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({ tone, className, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
