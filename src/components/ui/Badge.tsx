import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import type { TableStatus } from "@/lib/types";

type Tone = "neutral" | "accent" | TableStatus;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: "bg-surface-hover text-fg-muted",
  accent: "bg-accent-soft text-accent",
  free: "bg-status-free-soft text-status-free-fg",
  reserved: "bg-status-reserved-soft text-status-reserved-fg",
  occupied: "bg-status-occupied-soft text-status-occupied-fg",
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-medium leading-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
