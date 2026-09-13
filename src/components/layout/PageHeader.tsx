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
 * Shared page header — light kraft rail surface (`--nav-bg`) with dark
 * text/icons, matching the Sidebar. Centralized here so every screen's
 * header stays visually consistent and only needs to change in one place.
 */
export function PageHeader({ title, subtitle, left, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-nav-border bg-nav-bg px-4 py-3 sm:px-6 sm:py-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold text-nav-fg">{title}</h1>
          {subtitle && <p className="text-[12px] text-nav-fg-muted">{subtitle}</p>}
        </div>
        {left}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
