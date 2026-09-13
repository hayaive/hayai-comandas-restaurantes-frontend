type ClassValue = string | number | null | undefined | false | Record<string, boolean>;

/** Tiny classnames joiner — avoids pulling in a dependency for something this small. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
    } else {
      for (const key in value) {
        if (value[key]) out.push(key);
      }
    }
  }
  return out.join(" ");
}
