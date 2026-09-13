import { cn } from "@/lib/cn";

export interface BrandMarkProps {
  className?: string;
  /** Pixel size of the mark (width and height). Defaults to 28. */
  size?: number;
  /** Set when placed on a dark or gradient surface — swaps the edge ring for
   * one visible against it. */
  onDark?: boolean;
}

/**
 * Real brand seal (`/logo.jpg`) — a circular badge photographed on a solid
 * square background.
 *
 * The reference dashboard puts a gradient-filled `rounded-2xl` tile with a
 * glyph in this slot. That was NOT copied: this product has an actual brand
 * asset, and replacing a real mark with a generic gradient square would trade
 * the one piece of genuine identity the app owns for a template detail. What
 * was taken from the reference is the *frame* — by default the mark now sits
 * in a 16px rounded square that matches every other icon tile in the system,
 * instead of the bare circle it used to be. Pass
 * `className="rounded-full"` for the circular treatment where it reads better
 * (the login screen, where the mark is large and alone).
 *
 * The source photo is square with no transparency, so the container clips it:
 * `overflow-hidden` plus `object-cover` crops the square's corners away, and a
 * hairline ring gives the result a defined edge on any surface.
 */
export function BrandMark({ className, size = 28, onDark = false }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 overflow-hidden rounded-[var(--radius-md)] ring-1",
        onDark ? "ring-white/25" : "ring-black/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo.jpg"
        alt="Coffee &amp; Cake — para amantes del café"
        width={size}
        height={size}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
