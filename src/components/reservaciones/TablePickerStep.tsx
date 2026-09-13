import { Warning } from "@phosphor-icons/react";
import { FloorPlanCanvas } from "@/components/floor-plan/FloorPlanCanvas";
import { STATUS_META, STATUS_ORDER } from "@/components/floor-plan/statusMeta";
import { Button } from "@/components/ui/Button";
import { useFloorPlanStore } from "@/lib/useFloorPlanStore";
import type { FloorPlanTemplate, RestaurantTable } from "@/lib/types";

interface TablePickerStepProps {
  template: FloorPlanTemplate;
  onPick: (table: RestaurantTable) => void;
}

/**
 * Paso 1 de la reserva: elegir la mesa sobre la vista aérea real del salón.
 *
 * Reutiliza el mismo `FloorPlanCanvas` del editor —misma planta, mismos
 * colores de estado— en vez de dibujar otra representación que podría
 * contradecirlo. Aquí es sólo de lectura: `onMoveTable` es un no-op, así que
 * arrastrar no mueve nada, y sólo se pueden elegir las mesas libres.
 */
export function TablePickerStep({ template, onPick }: TablePickerStepProps) {
  const gridSize = useFloorPlanStore((s) => s.gridSize);
  const status = useFloorPlanStore((s) => s.status);
  const error = useFloorPlanStore((s) => s.error);
  const load = useFloorPlanStore((s) => s.load);

  function handleSelect(tableId: string | null) {
    if (!tableId) return;
    const table = template.tables.find((t) => t.id === tableId);
    // Ocupadas y reservadas se ven, pero no se pueden elegir.
    if (table && table.status === "free") onPick(table);
  }

  if (status === "loading" && template.tables.length === 0) {
    return (
      <p className="py-16 text-center text-[13px] text-fg-muted">Cargando el plano del salón…</p>
    );
  }

  if (status === "error" && template.tables.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Warning size={24} className="text-danger" weight="duotone" />
        <p className="text-[13px] text-fg-muted">{error ?? "No se pudo cargar el plano."}</p>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const libres = template.tables.filter((t) => t.status === "free").length;

  if (template.tables.length === 0) {
    return (
      <p className="py-16 text-center text-[13px] text-fg-muted">
        El salón todavía no tiene mesas dibujadas. Agrégalas desde la pantalla de Mesas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-fg-muted">
          Toca una mesa libre en <span className="font-medium text-fg">{template.name}</span>.
        </p>
        <ul className="flex items-center gap-3 font-mono text-[11px] text-fg-muted">
          {STATUS_ORDER.map((tableStatus) => (
            <li key={tableStatus} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[tableStatus].dotClass}`} />
              {STATUS_META[tableStatus].label.toLowerCase()}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex h-[min(46dvh,380px)] overflow-hidden rounded-[var(--radius-md)] border border-border">
        <FloorPlanCanvas
          tables={template.tables}
          selectedTableId={null}
          snapToGrid={false}
          gridSize={gridSize}
          onSelectTable={handleSelect}
          onMoveTable={() => {}}
        />
      </div>

      {libres === 0 && (
        <p className="text-[12px] text-status-reserved-fg">
          Ahora mismo no hay mesas libres. Puedes dejar que el cliente elija la suya al llegar.
        </p>
      )}
    </div>
  );
}
