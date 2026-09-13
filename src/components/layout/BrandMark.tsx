import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("h-6 w-6", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" className="fill-fg" />
      <circle cx="16" cy="16" r="8.5" stroke="var(--bg)" strokeWidth="2.4" />
      <circle cx="16" cy="5.4" r="1.7" className="fill-accent" />
      <circle cx="16" cy="26.6" r="1.7" className="fill-accent" />
      <circle cx="5.4" cy="16" r="1.7" className="fill-accent" />
      <circle cx="26.6" cy="16" r="1.7" className="fill-accent" />
    </svg>
  );
}
