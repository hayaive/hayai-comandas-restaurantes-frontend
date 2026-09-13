import { Circle, MagnetStraight, Square } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/Switch";

interface BottomToolbarProps {
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onAddTable: (shape: "circle" | "square") => void;
}

export function BottomToolbar({ snapToGrid, onToggleSnap, onAddTable }: BottomToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-border bg-surface px-3 py-2.5 sm:gap-x-6 sm:px-6 sm:py-3">
      <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-fg-subtle sm:inline">
        Agregar mesa
      </span>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAddTable("circle")}
          aria-label="Agregar mesa redonda"
          title="Agregar mesa redonda"
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-2.5 py-2 text-[13px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent sm:px-3"
        >
          <Circle size={18} weight="bold" />
          <span className="hidden sm:inline">Redonda</span>
        </button>
        <button
          type="button"
          onClick={() => onAddTable("square")}
          aria-label="Agregar mesa cuadrada"
          title="Agregar mesa cuadrada"
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-2.5 py-2 text-[13px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent sm:px-3"
        >
          <Square size={18} weight="bold" />
          <span className="hidden sm:inline">Cuadrada</span>
        </button>
      </div>

      <div className="hidden h-8 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-2 sm:gap-2.5 sm:px-3">
        <MagnetStraight size={16} className="text-fg-muted" />
        <span className="hidden text-[13px] text-fg-muted sm:inline">Ajustar a grilla</span>
        <Switch
          checked={snapToGrid}
          onChange={onToggleSnap}
          label={snapToGrid ? "Desactivar ajuste a grilla" : "Activar ajuste a grilla"}
        />
      </div>
    </div>
  );
}
