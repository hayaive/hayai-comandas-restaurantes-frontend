/**
 * Compatibility re-export.
 *
 * `cn` used to be a hand-rolled joiner living here, and ~40 files import it
 * from `@/lib/cn`. The real implementation now lives in `@/lib/utils` (the
 * shadcn/ui convention: `clsx` + `tailwind-merge`), which is a strict superset
 * of the old behaviour — it accepts everything the old one did, plus arrays and
 * nested values, and additionally de-conflicts Tailwind utilities so a
 * consumer's `className` reliably overrides a component's own classes.
 *
 * New code should import from `@/lib/utils`; this file exists so the migration
 * did not have to touch every call site at once.
 */
export { cn, type ClassValue } from "./utils";
