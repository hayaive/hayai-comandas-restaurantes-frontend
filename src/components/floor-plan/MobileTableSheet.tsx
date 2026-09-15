import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import type { RestaurantTable, TableShape as TableShapeKind } from "@/lib/types";
import { TableInspectorForm } from "./TableInspectorForm";

interface MobileTableSheetProps {
  table: RestaurantTable | null;
  onClose: () => void;
  onRename: (label: string) => void;
  onSetSeats: (seats: number) => void;
  onSetShape: (shape: TableShapeKind) => void;
  onDelete: () => void;
  onDeleteForever: () => void;
}

/**
 * Bottom-sheet counterpart to `TableInspectorPanel`, shown only below `md`
 * (real phones) via `md:hidden` — the fixed 280px side column doesn't fit a
 * ~360-400px viewport alongside the icon-only sidebar and the canvas.
 * Purely CSS-gated (no viewport JS), so it never doubles up with the
 * desktop column: at `md`+ this whole layer is `display:none` regardless of
 * `table`/open state.
 */
export function MobileTableSheet({ table, onClose, ...formProps }: MobileTableSheetProps) {
  const open = table !== null;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !table) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={`Editar mesa ${table.label}`}>
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
          "absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[var(--radius-lg)] border-t border-border bg-surface shadow-[var(--shadow-token-lg)] transition-transform duration-200 ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex justify-center pt-2.5" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <span className="text-lg font-semibold text-fg">Mesa {table.label}</span>
          <IconButton icon={<X size={16} />} label="Cerrar" size="sm" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <TableInspectorForm table={table} {...formProps} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
