import { useEffect, useMemo } from "react";
import { useFloorPlanStore } from "./useFloorPlanStore";
import { useComandaStore } from "./useComandaStore";

/**
 * La costura entre el editor de plano y el panel de comandas.
 *
 * Desde que el plano está conectado al backend, la ocupación real la calcula el
 * servidor (`v_mesa_estado`): una mesa está ocupada si y sólo si tiene una
 * comanda viva. Este hook ya no *define* ese estado, sólo cierra el círculo de
 * las acciones que el usuario hace desde el editor:
 *
 * - marcar una mesa como ocupada en el inspector abre su comanda (`POST /comandas`);
 * - devolverla a libre a mano anula la comanda que había quedado colgando.
 *
 * Dos guardas importantes, que antes no hacían falta porque todo era local:
 *
 * 1. Una comanda `para_llevar` no tiene `mesaId`; nunca debe anularse por no
 *    encontrar su mesa en el plano.
 * 2. Sólo se anulan comandas de mesas que están **en las plantillas cargadas**.
 *    Si una comanda apunta a una mesa que no está en este plano (otro salón,
 *    otra distribución, o el plano aún no terminó de cargar), se deja en paz:
 *    anularla sería destruir una comanda real por un dato incompleto.
 */
export function useSyncComandasWithFloorPlan() {
  const templates = useFloorPlanStore((state) => state.templates);
  const floorStatus = useFloorPlanStore((state) => state.status);
  const status = useComandaStore((state) => state.status);
  const comandas = useComandaStore((state) => state.comandas);
  const ensureComandaForTable = useComandaStore((state) => state.ensureComandaForTable);
  const releaseComandaForTable = useComandaStore((state) => state.releaseComandaForTable);

  const allTables = useMemo(() => templates.flatMap((tpl) => tpl.tables), [templates]);

  useEffect(() => {
    if (status !== "ready" || floorStatus !== "ready") return;

    const knownTableIds = new Set(allTables.map((t) => t.id));
    const occupiedTableIds = new Set(
      allTables.filter((t) => t.status === "occupied").map((t) => t.id),
    );

    for (const table of allTables) {
      if (table.status === "occupied") {
        void ensureComandaForTable(table.id, table.label, table.occupantName);
      }
    }

    for (const comanda of comandas) {
      if (!comanda.mesaId) continue;
      if (!knownTableIds.has(comanda.mesaId)) continue;
      if (!occupiedTableIds.has(comanda.mesaId)) {
        void releaseComandaForTable(comanda.mesaId);
      }
    }
  }, [allTables, status, floorStatus, comandas, ensureComandaForTable, releaseComandaForTable]);
}
