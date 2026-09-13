import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * The "nothing here yet" state.
 *
 * The icon plate is a soft brand-tinted disc rather than a gray square: an
 * empty screen is the one moment the interface has nothing else to say, so it
 * is worth spending a little brand on. Measure is capped at ~34ch so the
 * description stays a readable two or three lines.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-[var(--radius-lg)] border border-accent/15 bg-accent-soft text-accent">
        {icon}
      </div>
      <div className="max-w-[34ch]">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
