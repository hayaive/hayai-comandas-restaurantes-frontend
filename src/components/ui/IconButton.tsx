import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "accent" | "danger" | "nav" | "footer";
type Size = "sm" | "md";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

const sizes: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, className, variant = "default", size = "md", active = false, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-sm)] border transition-colors duration-150",
        "active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        sizes[size],
        variant === "default" &&
          (active
            ? "border-accent bg-accent-soft text-accent"
            : "border-border bg-surface-raised text-fg-muted hover:bg-surface-hover hover:text-fg"),
        variant === "accent" && "border-accent bg-accent text-fg-on-accent hover:bg-accent-strong",
        variant === "danger" &&
          "border-danger/40 bg-danger-soft text-danger hover:bg-danger hover:text-white",
        variant === "nav" &&
          (active
            ? "border-transparent bg-accent-soft text-accent"
            : "border-transparent bg-transparent text-nav-fg-muted hover:bg-nav-bg-hover hover:text-nav-fg"),
        variant === "footer" &&
          (active
            ? "border-transparent bg-footer-bg-hover text-footer-accent"
            : "border-transparent bg-transparent text-footer-fg-muted hover:bg-footer-bg-hover hover:text-footer-fg"),
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
