import type { ReactNode } from "react";
import { m } from "framer-motion";

import { cn } from "@/lib/utils";
import { useAppMotion } from "@/lib/useAppMotion";
import { Card } from "./Card";

/**
 * A `Card` that lifts under the pointer and presses in on tap.
 *
 * The reference wraps every card in its grids with
 * `whileHover={{ scale: 1.02, y: -5 }} whileTap={{ scale: 0.98 }}`. This does
 * the same thing with two deliberate adjustments:
 *
 * - **No hover scale.** Scaling a card re-rasterises its text every frame. On
 *   the host-stand tablets this app targets, a grid of a dozen scaling cards
 *   is visibly gritty. Translating on Y gets the same read of "this one is
 *   lifting" while staying a pure composite.
 * - **Tap is the real feedback.** Hover never fires on a touch screen, so the
 *   press-in is what a waiter actually perceives.
 *
 * The outer `m.div` owns the transform, the inner `Card` owns the
 * surface — `h-full` on both so a card in a grid row still stretches to the
 * tallest sibling and its footer stays bottom-aligned.
 */
export interface MotionCardProps {
  children: ReactNode;
  /**
   * The card as a whole is a click target: adds the pointer cursor and the
   * border-lights-up-on-hover treatment. On by default.
   */
  interactive?: boolean;
  /**
   * Lift under the pointer / press in on tap. Defaults to `interactive`.
   *
   * Split from `interactive` on purpose. A card that merely *contains*
   * buttons (a comanda, say) still belongs in the stagger and still reads
   * better with a press response, but must not grow a pointer cursor or a
   * hover outline — that would promise a click the card does not handle.
   */
  lift?: boolean;
  /** Participates in a parent `<StaggerGrid>` cascade. On by default. */
  stagger?: boolean;
  className?: string;
  onClick?: () => void;
}

export function MotionCard({
  children,
  interactive = true,
  lift,
  stagger = true,
  className,
  onClick,
}: MotionCardProps) {
  const motionPrefs = useAppMotion();
  const shouldLift = lift ?? interactive;

  return (
    <m.div
      variants={stagger ? motionPrefs.riseItem : undefined}
      {...(shouldLift ? motionPrefs.card : {})}
      className="h-full"
    >
      <Card interactive={interactive} onClick={onClick} className={cn("h-full", className)}>
        {children}
      </Card>
    </m.div>
  );
}
