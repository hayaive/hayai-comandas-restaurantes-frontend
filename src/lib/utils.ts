import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui's canonical class helper.
 *
 * `clsx` resolves conditional class values; `twMerge` then resolves Tailwind
 * conflicts by *specificity of the utility*, not by source order — so a
 * consumer's `className="px-6"` actually wins over a component's built-in
 * `px-4` instead of both landing in the class list and the cascade picking
 * whichever CSS rule happens to come last in the stylesheet. Every primitive
 * in `src/components/ui` funnels its classes through here, which is what
 * makes `className` overrides on them predictable.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
