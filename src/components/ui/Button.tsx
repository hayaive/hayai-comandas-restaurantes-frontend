import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonBase } from "./primitives/button";

/**
 * The app's button.
 *
 * Same machinery as the canonical shadcn button in `./primitives/button`
 * (CVA, Radix `Slot` for `asChild`, the shared `buttonBase` geometry, focus
 * ring and transition timing) expressed in this project's own variant
 * vocabulary, which every screen already uses.
 *
 * Two of those variants — `nav` and `footer` — exist because the kraft rail
 * and the black footer are fixed brand chrome that does not follow the
 * light/dark content theme; shadcn has no equivalent role for them, so they
 * tint their focus ring from their own surface instead of `--ring`.
 */
const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      /** The brand action: burnt terracotta, our `--primary`. */
      primary:
        "bg-primary text-primary-foreground shadow-[var(--shadow-token-sm)] hover:bg-accent-strong",
      /** The default, quiet action — a raised outlined chip on the surface. */
      secondary:
        "border border-input bg-surface-raised text-fg shadow-[var(--shadow-token-sm)] hover:border-border-strong hover:bg-surface-hover",
      ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
      danger:
        "bg-destructive text-destructive-foreground shadow-[var(--shadow-token-sm)] hover:brightness-110 focus-visible:ring-destructive/35",
      /** Ghost action on the light kraft rail (PageHeader, TasaBar, Sidebar). */
      nav: "text-nav-fg-muted hover:bg-nav-bg-hover hover:text-nav-fg",
      /** Ghost action on the black footer (Sidebar foot, MobileBottomNav). */
      footer:
        "text-footer-fg-muted hover:bg-footer-bg-hover hover:text-footer-fg focus-visible:ring-footer-accent/55",
    },
    size: {
      sm: "h-8 gap-1.5 px-3 text-[13px]",
      md: "h-9 px-4",
      lg: "h-10 px-6",
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "md",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child element (a router `<Link>`, say) instead of `<button>`. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, asChild = false, ...props }, ref) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

export { buttonVariants };
