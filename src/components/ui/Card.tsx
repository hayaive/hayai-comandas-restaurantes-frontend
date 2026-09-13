import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The app's card, on shadcn's anatomy.
 *
 * Kept as plain elements rather than re-exported from `primitives/` because a
 * card has no Radix behaviour to inherit — only styling — and this project's
 * header is a divided bar (`CardHeader` sits on a border) rather than
 * shadcn's borderless stacked title block.
 *
 * `CardTitle` / `CardDescription` / `CardFooter` are new and available for new
 * screens; `CardBody` is this project's long-standing name for shadcn's
 * `CardContent`, and both are exported so nothing has to be renamed.
 */
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-[var(--radius-lg)] border border-border bg-card text-card-foreground",
        "shadow-[var(--shadow-token-sm)] transition-shadow duration-200 ease-out",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-[14px] font-semibold leading-tight tracking-[-0.01em] text-fg",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[13px] leading-relaxed text-fg-muted", className)}
      {...props}
    />
  );
}

function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn("p-4", className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex shrink-0 items-center gap-2 border-t border-border px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardBody,
  /** shadcn's name for `CardBody`. Same component. */
  CardBody as CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
