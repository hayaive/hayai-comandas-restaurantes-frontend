import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The rounded square an icon sits in.
 *
 * The reference uses this constantly — `h-12 w-12 rounded-2xl bg-muted` with a
 * tinted icon inside — for app cards, file rows, stat tiles and the brand
 * mark. It is the element that makes a flat neutral list read as a designed
 * surface rather than a table of text, so it is worth having as a real
 * component instead of a class string copied around.
 *
 * On `tone`: the reference tints only the *glyph* and leaves the plate neutral
 * for most cases, and fills the plate with a gradient for brand moments. Both
 * are available. `active` is the client-mandated brown — use it for the tile
 * of a currently-selected thing, never for decoration.
 */
const iconTileVariants = cva(
  "flex shrink-0 items-center justify-center rounded-[var(--radius-md)] [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        /** Neutral plate, muted glyph — the workhorse. */
        neutral: "bg-surface-hover text-fg-muted",
        /** Neutral plate, brand glyph. */
        brand: "bg-accent-soft text-accent",
        /** Filled with the brand gradient, white glyph — for brand moments. */
        gradient: "hero-brand text-white shadow-[var(--shadow-token-sm)]",
        /** Client-mandated active/selected fill. */
        active: "bg-active text-active-fg",
        free: "bg-status-free-soft text-status-free-fg",
        reserved: "bg-status-reserved-soft text-status-reserved-fg",
        occupied: "bg-status-occupied-soft text-status-occupied-fg",
        danger: "bg-danger-soft text-danger",
      },
      size: {
        sm: "size-9",
        md: "size-11",
        lg: "size-12",
        xl: "size-14",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "lg",
    },
  },
);

export interface IconTileProps
  extends VariantProps<typeof iconTileVariants> {
  children: ReactNode;
  className?: string;
}

export function IconTile({ children, tone, size, className }: IconTileProps) {
  return (
    <span aria-hidden="true" className={cn(iconTileVariants({ tone, size }), className)}>
      {children}
    </span>
  );
}

export { iconTileVariants };
