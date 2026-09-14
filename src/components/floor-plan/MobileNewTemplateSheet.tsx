import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

interface MobileNewTemplateSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

/**
 * Mobile counterpart to `TemplateSwitcher`'s inline "nueva plantilla" input
 * (which only makes sense next to a row of pills that no longer exists below
 * `md`, see `TemplateSwitcher.tsx`). Same bottom-sheet language as
 * `MobileMoreSheet.tsx` / `MobileTableSheet.tsx` — portal to `document.body`,
 * blurred backdrop, rounded sheet sliding up from the bottom with a drag
 * handle and a header with title + close — reused rather than inventing a
 * fourth overlay pattern.
 */
export function MobileNewTemplateSheet({ open, onClose, onCreate }: MobileNewTemplateSheetProps) {
  const [entered, setEntered] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setName("");
    const frame = requestAnimationFrame(() => {
      setEntered(true);
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Nueva organización de mesas">
      <div
        className={cn(
          "absolute inset-0 bg-[var(--overlay)] backdrop-blur-[3px] transition-opacity duration-200",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[75dvh] flex-col rounded-t-[var(--radius-lg)] border-t border-border bg-surface shadow-[var(--shadow-token-lg)] transition-transform duration-200 ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex justify-center pt-2.5" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <span className="text-lg font-semibold text-fg">Nueva organización de mesas</span>
          <IconButton icon={<X size={16} />} label="Cerrar" size="sm" onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <label htmlFor="mobile-new-template-name" className="mb-2 block text-sm font-medium text-fg">
            Nombre
          </label>
          <input
            id="mobile-new-template-name"
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="p. ej. Terraza"
            className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-surface-raised px-3.5 text-[15px] text-fg outline-none focus-visible:border-accent"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" className="flex-1" onClick={commit} disabled={!name.trim()}>
            Crear
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
