import type { ReactNode } from "react";
import { m } from "framer-motion";

import { cn } from "@/lib/utils";
import { useAppMotion } from "@/lib/useAppMotion";
import { Card } from "./Card";
import { IconTile, type IconTileProps } from "./IconTile";

/**
 * One headline figure: an icon plate, a quiet label, and a large tabular
 * number. The reference's KPI row, adapted for money and counts.
 *
 * The number is set in the mono face with `tabular-nums` on purpose — these
 * tiles refresh while a cashier is reading them, and proportional digits make
 * the value visibly shift width as it changes. Tabular figures hold the
 * column still.
 *
 * `hint` is for the quiet line underneath (a comparison, a caveat). Keep it
 * short; it is 12px and muted by design, not a place for a sentence.
 */
export interface StatTileProps {
  icon: ReactNode;
  tone?: IconTileProps["tone"];
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}

export function StatTile({ icon, tone = "brand", label, value, hint, className }: StatTileProps) {
  const motionPrefs = useAppMotion();

  return (
    <m.div variants={motionPrefs.riseItem} className="h-full">
      <Card className={cn("h-full", className)}>
        <div className="flex items-center gap-4 p-5">
          <IconTile tone={tone} size="md">
            {icon}
          </IconTile>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-fg-muted">{label}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums leading-tight text-fg">
              {value}
            </p>
            {hint && <p className="mt-0.5 truncate text-[12px] text-fg-subtle">{hint}</p>}
          </div>
        </div>
      </Card>
    </m.div>
  );
}
