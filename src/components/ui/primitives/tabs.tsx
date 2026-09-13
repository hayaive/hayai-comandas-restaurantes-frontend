import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(function Tabs({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Root
      ref={ref}
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
});

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-[var(--radius-pill)] bg-surface-sunken p-1",
        className,
      )}
      {...props}
    />
  );
});

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1 text-[13px] font-medium text-fg-muted",
        "transition-[background-color,color,box-shadow] duration-150 ease-out outline-none",
        "hover:text-fg",
        "focus-visible:ring-[3px] focus-visible:ring-ring/45",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-surface-raised data-[state=active]:text-fg data-[state=active]:shadow-[var(--shadow-token-sm)]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
});

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
});

export { Tabs, TabsContent, TabsList, TabsTrigger };
