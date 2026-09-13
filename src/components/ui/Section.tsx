import type { ReactNode } from "react";
import { m } from "framer-motion";

import { cn } from "@/lib/utils";
import { useAppMotion } from "@/lib/useAppMotion";

/**
 * A titled block of content — the reference's basic unit of page rhythm.
 *
 * The reference stacks `<section>`s with `space-y-8` between them and
 * `space-y-4` inside, and gives each one a `text-2xl font-semibold` heading
 * with an optional quiet action on the right ("View All"). Encoding that here
 * rather than repeating it on nine screens is what keeps the vertical rhythm
 * identical everywhere — the most common way a redesign like this drifts is
 * that each page invents its own heading size and gap.
 *
 * Content fades up on mount. Wrap grids in `<StaggerGrid>` when the children
 * should cascade rather than arrive together.
 */
export interface SectionProps {
  title?: string;
  description?: ReactNode;
  /** Right-aligned control on the heading row. Keep it quiet — ghost or link. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, description, action, children, className }: SectionProps) {
  const motionPrefs = useAppMotion();

  return (
    <m.section
      variants={motionPrefs.rise}
      initial="hidden"
      animate="visible"
      className={cn("flex flex-col gap-4", className)}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-xl font-semibold text-fg sm:text-2xl">{title}</h2>}
            {description && (
              <p className="mt-1 max-w-[62ch] text-sm text-fg-muted">{description}</p>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </m.section>
  );
}

/**
 * A grid whose children cascade in. Children must be `<m.*>` elements
 * carrying `variants={m.riseItem}` — `MotionCard` already does.
 */
export function StaggerGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const motionPrefs = useAppMotion();

  return (
    <m.div
      variants={motionPrefs.stagger}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </m.div>
  );
}

/**
 * The page body every staff screen shares: scrolls independently of the
 * header, keeps a real gutter at phone width, and stacks its sections on the
 * reference's 8-unit rhythm.
 */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6",
        "[&>*+*]:mt-6 sm:[&>*+*]:mt-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
