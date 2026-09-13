import type { ReactNode } from "react";
import { m } from "framer-motion";

import { cn } from "@/lib/utils";
import { useAppMotion } from "@/lib/useAppMotion";

/**
 * The gradient banner that opens a screen.
 *
 * This is the single most recognisable element of the reference dashboard:
 * a full-width `rounded-3xl` block filled with a three-stop gradient, white
 * text, an optional eyebrow badge, and a slowly rotating concentric-disc
 * ornament on the right at large widths.
 *
 * Each screen picks a `tone`, and the tone is what tells a user at a glance
 * which part of the product they are in — Comandas is violet, Ventas is green,
 * Productos is warm. The five gradients are defined once as `.hero-*` classes
 * in `global.css`; there is deliberately no escape hatch for a sixth.
 *
 * Accessibility notes that are easy to lose in a redesign:
 * - the ornament is `aria-hidden` and purely decorative;
 * - every gradient stop was picked dark enough that white body text clears
 *   4.5:1 across the whole width, including the lightest end;
 * - `stat` values use tabular figures so a refreshing number does not jitter.
 */

export type HeroTone = "brand" | "royal" | "warm" | "fresh" | "cool";

const TONE_CLASS: Record<HeroTone, string> = {
  brand: "hero-brand",
  royal: "hero-royal",
  warm: "hero-warm",
  fresh: "hero-fresh",
  cool: "hero-cool",
};

export interface PageHeroStat {
  label: string;
  value: ReactNode;
}

export interface PageHeroProps {
  tone?: HeroTone;
  /** Small pill above the title. Use for context, not for decoration. */
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Buttons or controls, rendered under the description. */
  actions?: ReactNode;
  /** Up to three figures shown on the right instead of the disc ornament. */
  stats?: PageHeroStat[];
  className?: string;
}

export function PageHero({
  tone = "brand",
  eyebrow,
  title,
  description,
  actions,
  stats,
  className,
}: PageHeroProps) {
  const motionPrefs = useAppMotion();

  return (
    <m.section
      variants={motionPrefs.rise}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] px-5 py-6 text-white sm:px-8 sm:py-8",
        TONE_CLASS[tone],
        className,
      )}
    >
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          {eyebrow && (
            <span className="w-fit rounded-[var(--radius-sm)] bg-white/20 px-2.5 py-1 text-[12px] font-medium leading-none text-white">
              {eyebrow}
            </span>
          )}
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
          {description && (
            <p className="max-w-[58ch] text-sm leading-relaxed text-white/80">{description}</p>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
        </div>

        {stats && stats.length > 0 ? (
          <dl className="flex shrink-0 flex-wrap gap-x-8 gap-y-3 md:justify-end">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-[88px]">
                <dt className="text-[12px] font-medium text-white/80">{stat.label}</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <HeroOrnament reduced={motionPrefs.reduced} />
        )}
      </div>
    </m.section>
  );
}

/**
 * The reference's concentric translucent discs, rotating once every 50s.
 * Hidden below `lg` — on a phone it would only steal width from the title —
 * and frozen entirely when the user asked for reduced m.
 */
function HeroOrnament({ reduced }: { reduced: boolean }) {
  return (
    <m.div
      aria-hidden="true"
      className="relative hidden h-32 w-32 shrink-0 lg:block"
      animate={reduced ? undefined : { rotate: 360 }}
      transition={
        reduced ? undefined : { duration: 50, repeat: Number.POSITIVE_INFINITY, ease: "linear" }
      }
    >
      <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-md" />
      <div className="absolute inset-3 rounded-full bg-white/15" />
      <div className="absolute inset-6 rounded-full bg-white/20" />
      <div className="absolute inset-9 rounded-full bg-white/25" />
      <div className="absolute inset-12 rounded-full bg-white/40" />
    </m.div>
  );
}
