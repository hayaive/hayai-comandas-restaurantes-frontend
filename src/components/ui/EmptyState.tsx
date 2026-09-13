import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { IconTile } from "./IconTile";

/**
 * The "nothing here yet" state.
 *
 * An empty screen is the one moment the interface has nothing else to say, so
 * it is worth spending a little brand on: the icon sits on the brand-gradient
 * tile rather than a gray square. Measure is capped at ~38ch so the
 * description stays a readable two or three lines rather than one long band.
 */
export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

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
        "flex flex-1 flex-col items-center justify-center gap-4 px-6 py-14 text-center",
        className,
      )}
    >
      <IconTile tone="gradient" size="xl">
        {icon}
      </IconTile>
      <div className="max-w-[38ch]">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
