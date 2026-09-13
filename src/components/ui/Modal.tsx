import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./primitives/dialog";

/** `lg` existe para el contenido que necesita ancho real, como el plano del salón. */
type ModalSize = "md" | "lg";

const SIZES: Record<ModalSize, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-3xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * The app's modal — a header/scrolling-body/footer shell over the shadcn
 * Dialog, keeping the `{ open, onClose, title, … }` API every screen already
 * passes.
 *
 * Moving to Radix retires a whole class of bug rather than just restyling one.
 * The hand-rolled version ran a `useEffect` that queried the panel for
 * focusables and called `.focus()`; because `onClose` arrived as a fresh inline
 * closure on every render, that effect had to be defended with a ref or every
 * keystroke in a modal input stole focus back to the close button. Radix owns
 * focus, the focus trap, focus restore, `aria-modal`, the Escape handler,
 * outside-press dismissal and the body scroll lock, so none of that bookkeeping
 * lives here any more — and the panel now animates in and out instead of
 * appearing and vanishing between two frames.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        // Radix auto-wires `aria-describedby` to its `DialogDescription`, and
        // warns in dev when a dialog renders without one. Modals that have no
        // subtitle opt out explicitly so the console stays clean and no
        // dangling id is left pointing at an element that never renders.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0",
          SIZES[size],
        )}
      >
        <DialogHeader className="flex shrink-0 flex-row items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0 space-y-0.5">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
          <IconButton
            icon={<X size={16} />}
            label="Cerrar"
            size="sm"
            className="-mr-2 -mt-1.5 shrink-0 text-fg-subtle"
            onClick={onClose}
          />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-surface-sunken/60 px-6 py-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
