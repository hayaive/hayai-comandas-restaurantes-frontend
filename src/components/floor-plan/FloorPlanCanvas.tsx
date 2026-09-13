import { useCallback, useRef } from "react";
import type { RestaurantTable } from "@/lib/types";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Point } from "./geometry";
import { TableShape } from "./TableShape";

interface FloorPlanCanvasProps {
  tables: RestaurantTable[];
  selectedTableId: string | null;
  snapToGrid: boolean;
  gridSize: number;
  onSelectTable: (tableId: string | null) => void;
  onMoveTable: (tableId: string, x: number, y: number) => void;
}

export function FloorPlanCanvas({
  tables,
  selectedTableId,
  snapToGrid,
  gridSize,
  onSelectTable,
  onMoveTable,
}: FloorPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const toCanvasPoint = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  return (
    <div className="relative flex-1 overflow-auto bg-bg-canvas p-6">
      <div
        className="mx-auto rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-token-sm)]"
        style={{ maxWidth: CANVAS_WIDTH + 48, aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="h-full w-full touch-none"
          onPointerDown={() => onSelectTable(null)}
        >
          <defs>
            <pattern id="floor-grid-dots" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} className="fill-[var(--canvas-dot)]" />
            </pattern>
          </defs>
          <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} rx={16} fill="url(#floor-grid-dots)" />

          {tables.map((table) => (
            <TableShape
              key={table.id}
              table={table}
              selected={table.id === selectedTableId}
              snapToGrid={snapToGrid}
              gridSize={gridSize}
              toCanvasPoint={toCanvasPoint}
              onSelect={onSelectTable}
              onMove={onMoveTable}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
