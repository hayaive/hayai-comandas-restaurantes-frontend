import { useEffect, useMemo } from "react";
import { useFloorPlanStore } from "./useFloorPlanStore";
import { useComandaStore } from "./useComandaStore";

/**
 * The seam between the floor plan editor and the comandas panel.
 *
 * `useFloorPlanStore` (untouched, owned by the floor plan editor) stays the
 * single source of truth for table status. This hook watches every
 * template's tables — not just the one currently shown in the editor, so
 * switching the visible template does not cancel comandas open elsewhere —
 * and keeps `useComandaStore` in sync: a table that turns "occupied" (from
 * the editor's inspector, from a walk-in, or from a check-in) gets a comanda
 * opened for it if it doesn't have one yet; a table that stops being
 * occupied without going through "cobrar" (e.g. a host resets it to free by
 * hand) gets its dangling comanda cancelled. Both ends are idempotent, so
 * mounting this in more than one screen is harmless.
 */
export function useSyncComandasWithFloorPlan() {
  const templates = useFloorPlanStore((state) => state.templates);
  const status = useComandaStore((state) => state.status);
  const comandas = useComandaStore((state) => state.comandas);
  const ensureComandaForTable = useComandaStore((state) => state.ensureComandaForTable);
  const releaseComandaForTable = useComandaStore((state) => state.releaseComandaForTable);

  const allTables = useMemo(() => templates.flatMap((tpl) => tpl.tables), [templates]);

  useEffect(() => {
    if (status !== "ready") return;

    const occupiedTableIds = new Set(
      allTables.filter((t) => t.status === "occupied").map((t) => t.id),
    );

    for (const table of allTables) {
      if (table.status === "occupied") {
        void ensureComandaForTable(table.id, table.label, table.occupantName);
      }
    }

    for (const comanda of comandas) {
      if (!occupiedTableIds.has(comanda.mesaId)) {
        void releaseComandaForTable(comanda.mesaId);
      }
    }
  }, [allTables, status, comandas, ensureComandaForTable, releaseComandaForTable]);
}
