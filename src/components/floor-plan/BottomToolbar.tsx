import { Circle, Square } from "lucide-react";

interface BottomToolbarProps {
  onAddTable: (shape: "circle" | "square") => void;
}

/** The docked bar under the floor-plan canvas: add a table. */
export function BottomToolbar({ onAddTable }: BottomToolbarProps) {
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
