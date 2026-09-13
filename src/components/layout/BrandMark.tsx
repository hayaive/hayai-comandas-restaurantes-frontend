import { cn } from "@/lib/cn";

export interface BrandMarkProps {
  className?: string;
  /** Pixel size of the circular mark (width and height). Defaults to 28. */
  size?: number;
  /** Set when placed on a dark surface (e.g. the black footer) — swaps the
   * edge ring for one visible against dark backgrounds. Current call sites
   * (Sidebar rail, LoginPage, SelfSeatPage) all sit on light surfaces, but
   * the prop stays available for a future dark placement. */
  onDark?: boolean;
}

/**
 * Real brand seal (`/logo.jpg`) — a circular badge photographed on a solid
 * square background. The image itself is already circular art, so instead
 * of processing the file we crop it in CSS: an `overflow-hidden` circular
 * container clips away the square's corners, leaving just the round seal
 * regardless of what surface it sits on. A hairline ring gives it a defined
 * edge since the source photo has no transparency of its own.
 */
export function BrandMark({ className, size = 28, onDark = false }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 overflow-hidden rounded-full ring-1",
        onDark ? "ring-white/20" : "ring-black/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo.jpg"
        alt="Coffee & Cake — para amantes del café"
        width={size}
        height={size}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
