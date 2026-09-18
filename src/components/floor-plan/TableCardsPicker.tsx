import { STATUS_META, STATUS_ORDER } from "@/components/floor-plan/statusMeta";
import { cn } from "@/lib/utils";
import type { RestaurantTable } from "@/lib/types";

export interface TableCardsPickerProps {
  tables: RestaurantTable[];
  onPick: (table: RestaurantTable) => void;
  selectedTableId?: string | null;
  disabled?: boolean;
  /**
   * Por defecto (`false`) sólo las mesas libres son tocables — eso es lo que
   * necesitan `TablePickerStep` (reservar) y `EscanearPage` (sentar): elegir
   * una mesa ocupada o reservada ahí no tiene sentido de negocio. El editor
   * de plano (`FloorPlanPage`, vista lista) es distinto: ahí se toca CUALQUIER
   * mesa para abrir su inspector y editarla (renombrar, sillas, eliminar), sin
   * importar su estado. `true` habilita eso sin tocar el comportamiento de los
   * dos usos existentes, que no pasan esta prop.
   */
  selectAny?: boolean;
}

/**
 * Selector de mesa como lista de cards, pensado para mobile.
 *
 * La vista aérea (`FloorPlanCanvas`) exige precisión de arrastre/zoom que es
 * incómoda con el pulgar en un teléfono, y en el flujo de check-in el
 * anfitrión suele estar parado con el celular en una mano. Este componente
 * copia el lenguaje visual que ya usa `MeseroPage` ("1. Elige una mesa") en
 * vez de inventar un tercer patrón para elegir mesa.
 *
 * Se muestran TODAS las mesas (no sólo las libres) para que quien elige vea
 * el contexto de ocupación completo; por defecto sólo las libres son
 * interactivas (ver `selectAny` para el caso del editor de plano, que
 * necesita poder tocar cualquier mesa).
 */
export function TableCardsPicker({
  tables,
  onPick,
  selectedTableId = null,
  disabled = false,
  selectAny = false,
}: TableCardsPickerProps) {
  // Libres primero, y dentro de cada grupo por etiqueta con orden numérico
  // ("M-2" antes que "M-10") en vez del orden lexicográfico por defecto.
  const sorted = [...tables].sort((a, b) => {
    if (a.status === "free" && b.status !== "free") return -1;
    if (a.status !== "free" && b.status === "free") return 1;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-fg-muted">
        {STATUS_ORDER.map((tableStatus) => (
          <li key={tableStatus} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_META[tableStatus].dotClass}`} />
            {STATUS_META[tableStatus].label.toLowerCase()}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((table) => {
          const meta = STATUS_META[table.status];
          const isSelected = table.id === selectedTableId;
          const isPickable = (selectAny || table.status === "free") && !disabled;
          return (
            <button
              key={table.id}
              type="button"
              disabled={!isPickable}
              aria-pressed={isSelected}
              aria-disabled={!isPickable}
              aria-label={`Mesa ${table.label}, ${meta.label.toLowerCase()}${
                table.occupantName ? `, ${table.occupantName}` : ""
              }`}
              onClick={() => onPick(table)}
              className={cn(
                "flex min-h-11 flex-col items-start gap-1 rounded-[var(--radius-md)] border px-3.5 py-3 text-left",
                "transition-colors duration-150",
                "disabled:pointer-events-none disabled:opacity-60",
                isSelected
                  ? "border-transparent bg-active"
                  : "border-border bg-surface-raised hover:border-border-strong hover:bg-surface-hover",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    isSelected ? "text-active-fg" : "text-fg",
                  )}
                >
                  {table.label}
                </span>
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    isSelected ? "bg-white/80" : meta.dotClass,
                  )}
                />
              </div>
              <span
                className={cn(
                  "w-full truncate text-[11px]",
                  isSelected ? "text-active-fg/80" : "text-fg-subtle",
                )}
              >
                {meta.label}
                {table.occupantName ? ` · ${table.occupantName}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
