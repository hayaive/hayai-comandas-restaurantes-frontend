import { useMemo } from "react";
import { useActiveTemplate, useFloorPlanStore, useSelectedTable } from "@/lib/useFloorPlanStore";
import { Toolbar } from "@/components/floor-plan/Toolbar";
import { FloorPlanCanvas } from "@/components/floor-plan/FloorPlanCanvas";
import { TableInspectorPanel } from "@/components/floor-plan/TableInspectorPanel";
import { TemplateSwitcher } from "@/components/floor-plan/TemplateSwitcher";
import { STATUS_META, STATUS_ORDER } from "@/components/floor-plan/statusMeta";

export function FloorPlanPage() {
  const templates = useFloorPlanStore((state) => state.templates);
  const activeTemplateId = useFloorPlanStore((state) => state.activeTemplateId);
  const snapToGrid = useFloorPlanStore((state) => state.snapToGrid);
  const gridSize = useFloorPlanStore((state) => state.gridSize);
  const selectedTableId = useFloorPlanStore((state) => state.selectedTableId);

  const selectTemplate = useFloorPlanStore((state) => state.selectTemplate);
  const addTemplate = useFloorPlanStore((state) => state.addTemplate);
  const removeTemplate = useFloorPlanStore((state) => state.removeTemplate);
  const addTable = useFloorPlanStore((state) => state.addTable);
  const moveTable = useFloorPlanStore((state) => state.moveTable);
  const removeTable = useFloorPlanStore((state) => state.removeTable);
  const renameTable = useFloorPlanStore((state) => state.renameTable);
  const setSeats = useFloorPlanStore((state) => state.setSeats);
  const setShape = useFloorPlanStore((state) => state.setShape);
  const setStatus = useFloorPlanStore((state) => state.setStatus);
  const selectTable = useFloorPlanStore((state) => state.selectTable);
  const toggleSnapToGrid = useFloorPlanStore((state) => state.toggleSnapToGrid);

  const activeTemplate = useActiveTemplate();
  const selectedTable = useSelectedTable();

  const statusCounts = useMemo(() => {
    const counts = { free: 0, reserved: 0, occupied: 0 } as Record<string, number>;
    for (const table of activeTemplate.tables) counts[table.status] += 1;
    return counts;
  }, [activeTemplate.tables]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-[16px] font-semibold text-fg">Mesas</h1>
          <TemplateSwitcher
            templates={templates}
            activeTemplateId={activeTemplateId}
            onSelect={selectTemplate}
            onCreate={addTemplate}
            onDelete={removeTemplate}
          />
        </div>

        <ul className="flex items-center gap-3 font-mono text-[12px] text-fg-muted">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dotClass}`} />
              {statusCounts[status]} {STATUS_META[status].label.toLowerCase()}
            </li>
          ))}
        </ul>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar snapToGrid={snapToGrid} onToggleSnap={toggleSnapToGrid} onAddTable={addTable} />

        <FloorPlanCanvas
          tables={activeTemplate.tables}
          selectedTableId={selectedTableId}
          snapToGrid={snapToGrid}
          gridSize={gridSize}
          onSelectTable={selectTable}
          onMoveTable={moveTable}
        />

        <TableInspectorPanel
          table={selectedTable}
          onRename={(label) => selectedTable && renameTable(selectedTable.id, label)}
          onSetSeats={(seats) => selectedTable && setSeats(selectedTable.id, seats)}
          onSetShape={(shape) => selectedTable && setShape(selectedTable.id, shape)}
          onSetStatus={(status, occupantName) =>
            selectedTable && setStatus(selectedTable.id, status, occupantName)
          }
          onDelete={() => selectedTable && removeTable(selectedTable.id)}
        />
      </div>
    </div>
  );
}
