import { TableCardsPicker } from "@/components/floor-plan/TableCardsPicker";
import { Button } from "@/components/ui/Button";
import { useFloorPlanStore } from "@/lib/useFloorPlanStore";
import type { FloorPlanTemplate, RestaurantTable } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

interface TablePickerStepProps {
  template: FloorPlanTemplate;
  onPick: (table: RestaurantTable) => void;
}

/**
 * Paso 1 de la reserva: elegir la mesa desde una lista de cards.
 *
 * Antes usaba `FloorPlanCanvas` (la vista aérea del salón), pero en mobile
 * arrastrar/hacer zoom sobre el plano para tocar la mesa correcta es
 * incómodo con el pulgar. `TableCardsPicker` ya se encarga de mostrar todas
 * las mesas con su estado y de que sólo las libres se puedan elegir —
 * `FloorPlanCanvas` sigue existiendo tal cual para el editor de plano, que sí
 * necesita la posición real de cada mesa.
 */
export function TablePickerStep({ template, onPick }: TablePickerStepProps) {
  const status = useFloorPlanStore((s) => s.status);
  const error = useFloorPlanStore((s) => s.error);
  const load = useFloorPlanStore((s) => s.load);

  if (status === "loading" && template.tables.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-fg-muted">Cargando el plano del salón…</p>
    );
  }

  if (status === "error" && template.tables.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle size={24} className="text-danger" />
        <p className="text-sm text-fg-muted">{error ?? "No se pudo cargar el plano."}</p>
        <Button size="sm" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const libres = template.tables.filter((t) => t.status === "free").length;

  if (template.tables.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-fg-muted">
        El salón todavía no tiene mesas dibujadas. Agrégalas desde la pantalla de Mesas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        Toca una mesa libre en <span className="font-medium text-fg">{template.name}</span>.
      </p>

      <TableCardsPicker tables={template.tables} onPick={onPick} />

      {libres === 0 && (
        <p className="text-[12px] text-status-reserved-fg">
          Ahora mismo no hay mesas libres. Puedes dejar que el cliente elija la suya al llegar.
        </p>
      )}
    </div>
  );
}
