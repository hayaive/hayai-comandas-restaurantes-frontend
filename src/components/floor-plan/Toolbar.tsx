import { Circle, MagnetStraight, Square } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/Switch";
import { StatusLegend } from "./StatusLegend";

interface ToolbarProps {
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onAddTable: (shape: "circle" | "square") => void;
}

export function Toolbar({ snapToGrid, onToggleSnap, onAddTable }: ToolbarProps) {
  return (
    <aside className="flex w-[168px] shrink-0 flex-col gap-4 border-r border-border bg-surface px-3 py-4">
      <div>
        <span className="mb-2 block px-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          Agregar mesa
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAddTable("circle")}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-raised py-2.5 text-[11px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent"
          >
            <Circle size={20} weight="bold" />
            Redonda
          </button>
          <button
            type="button"
            onClick={() => onAddTable("square")}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-raised py-2.5 text-[11px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent"
          >
            <Square size={20} weight="bold" />
            Cuadrada
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5">
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          <MagnetStraight size={16} />
          Ajustar a grilla
        </div>
        <Switch
          checked={snapToGrid}
          onChange={onToggleSnap}
          label={snapToGrid ? "Desactivar ajuste a grilla" : "Activar ajuste a grilla"}
        />
      </div>

      <StatusLegend />
    </aside>
  );
}
