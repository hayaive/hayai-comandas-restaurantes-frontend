import { EmptyState } from "@/components/ui/EmptyState";
import type { RestaurantTable, TableShape as TableShapeKind } from "@/lib/types";
import { TableInspectorForm } from "./TableInspectorForm";
import { Users } from "lucide-react";

interface TableInspectorPanelProps {
  table: RestaurantTable | null;
  onRename: (label: string) => void;
  onSetSeats: (seats: number) => void;
  onSetShape: (shape: TableShapeKind) => void;
  onDelete: () => void;
  onDeleteForever: () => void;
}

/**
 * Desktop/tablet side column. Below `md` (real phones) this hides entirely —
 * `MobileTableSheet` takes over as a bottom sheet so the canvas keeps the
 * full screen width instead of losing a fixed 280px column.
 */
export function TableInspectorPanel({ table, ...formProps }: TableInspectorPanelProps) {
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-surface md:flex">
      {table ? (
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <TableInspectorForm table={table} {...formProps} />
        </div>
      ) : (
        <EmptyState
          icon={<Users size={24} />}
          title="Ninguna mesa seleccionada"
          description="Toca una mesa en el plano para editar su número y sillas, o para ver y cobrar su cuenta."
        />
      )}
    </aside>
  );
}
