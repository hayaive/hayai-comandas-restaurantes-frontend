import { Circle, Magnet, Square } from "lucide-react";

import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";

interface BottomToolbarProps {
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onAddTable: (shape: "circle" | "square") => void;
}

/**
 * The docked bar under the floor-plan canvas: add a table, toggle grid snap.
 *
 * "Ajustar a grilla" is a mode, not a selection, so when it is on the whole
 * group picks up the brown active treatment — the host needs to see at a
 * glance whether dragging will snap, and a 36px switch alone is too small to
 * read across a counter. The group *tints* rather than fills, because the
 * switch track itself is already the solid brown and two solid browns stacked
 * would erase the thumb.
 */
export function BottomToolbar({ snapToGrid, onToggleSnap, onAddTable }: BottomToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-border bg-surface px-3 py-3 sm:gap-x-6 sm:px-6">
      <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-fg-subtle sm:inline">
        Agregar mesa
      </span>

      <div className="flex gap-2">
        <AddTableButton
          onClick={() => onAddTable("circle")}
          icon={<Circle size={18} />}
          label="Redonda"
          aria="Agregar mesa redonda"
        />
        <AddTableButton
          onClick={() => onAddTable("square")}
          icon={<Square size={18} />}
          label="Cuadrada"
          aria="Agregar mesa cuadrada"
        />
      </div>

      <div className="hidden h-8 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2",
          "transition-colors duration-150",
          snapToGrid
            ? "border-active bg-active-soft text-active-soft-fg"
            : "border-border bg-surface text-fg-muted",
        )}
      >
        <Magnet size={16} className="shrink-0" />
        <span className="hidden text-[13px] font-medium sm:inline">Ajustar a grilla</span>
        <Switch
          checked={snapToGrid}
          onChange={onToggleSnap}
          label={snapToGrid ? "Desactivar ajuste a grilla" : "Activar ajuste a grilla"}
        />
      </div>
    </div>
  );
}

function AddTableButton({
  onClick,
  icon,
  label,
  aria,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  aria: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3 py-2.5 text-[13px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent sm:px-3.5"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
