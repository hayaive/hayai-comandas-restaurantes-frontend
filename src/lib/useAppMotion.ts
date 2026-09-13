import { useMemo } from "react";
import { useReducedMotion, type Transition, type Variants } from "framer-motion";

/**
 * The app's entire motion vocabulary, in one place.
 *
 * Three constraints shaped it, and they are worth stating because they are
 * why this is a hook and not a `const` file:
 *
 * 1. **Framer Motion ignores the CSS reduced-motion guard.** `global.css`
 *    zeroes `animation-duration` and `transition-duration`, which stops every
 *    CSS animation in the product — but Framer animates inline styles through
 *    `requestAnimationFrame`, so it sails straight past that block. Honouring
 *    the preference therefore has to happen in JS, and doing it per component
 *    would guarantee somebody forgets. Every animated component in this app
 *    takes its variants from here, so the preference is honoured once.
 *
 * 2. **This app runs on host-stand tablets.** The reference dashboard leans on
 *    `whileHover={{ scale: 1.02, y: -5 }}`; a hover state costs nothing on a
 *    touch device (it never fires), but `whileTap` is the feedback that
 *    actually matters there, so tap is treated as the primary affordance and
 *    hover as the enhancement. Transforms only — never `width`/`height`/
 *    `top`/`left` — so everything stays on the compositor.
 *
 * 3. **Motion must not fight the floor plan.** `FloorPlanCanvas` and
 *    `TableShape` run pointer-capture drags at 60fps; nothing in this file is
 *    applied inside the canvas, deliberately.
 */

/** The reference's spring-ish feel, expressed as a cheap tween. */
const EASE_OUT: Transition["ease"] = [0.22, 1, 0.36, 1];

export interface AppMotion {
  /** True when the user asked for reduced motion; everything below is inert. */
  reduced: boolean;
  /** Page/section entrance: fade up. Pair with `initial`/`animate`. */
  rise: Variants;
  /** Staggered list/grid container. Children should use `riseItem`. */
  stagger: Variants;
  /** A single item inside a `stagger` container. */
  riseItem: Variants;
  /** Route + tab-panel crossfade, used with `AnimatePresence mode="wait"`. */
  swap: Variants;
  /** Interactive card: lift on hover, press in on tap. Spread onto `m.*`. */
  card: {
    whileHover?: { y: number; transition: Transition };
    whileTap?: { scale: number };
  };
  /** Quieter version of `card` for dense rows that must not jump. */
  row: {
    whileTap?: { scale: number };
  };
}

export function useAppMotion(): AppMotion {
  const reduced = useReducedMotion() ?? false;

  return useMemo<AppMotion>(() => {
    if (reduced) {
      // Not "a shorter animation" — no animation. Elements still need to end
      // up visible, so every variant resolves to the final state immediately.
      const instant: Variants = {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0, transition: { duration: 0 } },
        exit: { opacity: 1, y: 0, transition: { duration: 0 } },
      };
      return {
        reduced,
        rise: instant,
        stagger: instant,
        riseItem: instant,
        swap: instant,
        card: {},
        row: {},
      };
    }

    return {
      reduced,
      rise: {
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
      },
      stagger: {
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.045, delayChildren: 0.04 },
        },
      },
      riseItem: {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
      },
      swap: {
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
        exit: { opacity: 0, y: -8, transition: { duration: 0.14, ease: "easeIn" } },
      },
      card: {
        whileHover: { y: -4, transition: { duration: 0.18, ease: EASE_OUT } },
        whileTap: { scale: 0.985 },
      },
      row: {
        whileTap: { scale: 0.995 },
      },
    };
  }, [reduced]);
}
