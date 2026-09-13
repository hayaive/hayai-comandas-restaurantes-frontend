import { Circle, MagnetStraight, Square } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/Switch";

interface BottomToolbarProps {
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onAddTable: (shape: "circle" | "square") => void;
}

export function BottomToolbar({ snapToGrid, onToggleSnap, onAddTable }: BottomToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-border bg-surface px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          Agregar mesa
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAddTable("circle")}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-3 py-2 text-[13px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent"
          >
            <Circle size={18} weight="bold" />
            Redonda
          </button>
          <button
            type="button"
            onClick={() => onAddTable("square")}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-3 py-2 text-[13px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent"
          >
            <Square size={18} weight="bold" />
            Cuadrada
          </button>
        </div>
      </div>

      <div className="hidden h-8 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

      <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2">
        <MagnetStraight size={16} className="text-fg-muted" />
        <span className="text-[13px] text-fg-muted">Ajustar a grilla</span>
        <Switch
          checked={snapToGrid}
          onChange={onToggleSnap}
          label={snapToGrid ? "Desactivar ajuste a grilla" : "Activar ajuste a grilla"}
        />
      </div>
    </div>
  );
}
