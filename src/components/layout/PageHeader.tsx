import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  /** Page title, e.g. "Mesas". */
  title: string;
  /** Optional caption under the title. */
  subtitle?: ReactNode;
  /** Extra content next to the title block (e.g. a template switcher). */
  left?: ReactNode;
  /** Right-aligned controls (buttons, status pills, etc.). */
  actions?: ReactNode;
  className?: string;
}

/**
 * The bar at the top of every staff screen.
 *
 * Modelled on the reference's top bar: a fixed 64px row that sticks to the top
 * of the scrolling area, drawn on a translucent background with a backdrop
 * blur so content passing underneath stays faintly visible instead of
 * disappearing under an opaque slab. That blur is the detail that makes the
 * chrome read as a layer rather than a border.
 *
 * The previous version painted this in the kraft rail colour; like the
 * sidebar, it is now one continuous surface with the page (see `tokens.css`).
 *
 * `min-h-16` rather than a hard `h-16`: screens like Mesas put a template
 * switcher and a status legend in here, and on a narrow tablet those wrap to a
 * second row. A fixed height would clip them.
 */
export function PageHeader({ title, subtitle, left, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2",
        "border-b border-border bg-bg/85 px-4 py-3 backdrop-blur-md sm:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight text-fg">{title}</h1>
          {subtitle && <p className="truncate text-[12px] text-fg-muted">{subtitle}</p>}
        </div>
        {left}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
