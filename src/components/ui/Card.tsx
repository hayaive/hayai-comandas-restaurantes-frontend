import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The app's card, on the reference dashboard's anatomy.
 *
 * What changed in the redesign, and why each one matters:
 *
 * - **24px radius** (`--radius-lg`). The reference's cards are `rounded-3xl`.
 *   At that radius a 1px hairline border reads as a drawn outline rather than
 *   a box edge, which is most of why that dashboard feels soft rather than
 *   administrative.
 * - **Border carries the elevation, not the shadow.** The reference's card is
 *   `border-2 hover:border-primary/50` with no resting shadow — the card lifts
 *   by *outlining* under the pointer. A resting drop shadow on a 24px radius
 *   just muddies the corner, so the shadow now appears only on hover for
 *   interactive cards.
 * - **`interactive` is opt-in.** A card that is not clickable must not
 *   advertise a hover state; roughly half the cards in this product are
 *   passive containers.
 *
 * The header is still this project's divided bar (a real `border-b`) rather
 * than shadcn's borderless stacked title block, because every screen here uses
 * the header as a labelled strip with a control on the right.
 *
 * `CardBody` is this project's long-standing name for shadcn's `CardContent`;
 * both names are exported and are the same component.
 */
function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** Adds the reference's border-lights-up-on-hover treatment. */
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card text-card-foreground",
        "transition-[border-color,box-shadow] duration-300 ease-out",
        interactive &&
          "cursor-pointer hover:border-accent/45 hover:shadow-[var(--shadow-token-md)]",
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
        "flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4",
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
      className={cn("text-base font-medium leading-tight text-fg", className)}
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
      className={cn("text-sm leading-relaxed text-fg-muted", className)}
      {...props}
    />
  );
}

function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn("p-5", className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex shrink-0 items-center gap-2 border-t border-border px-5 py-4",
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
