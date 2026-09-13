import { useCallback, useRef } from "react";
import type { RestaurantTable } from "@/lib/types";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Point } from "./geometry";
import { TableShape } from "./TableShape";

interface FloorPlanCanvasProps {
  tables: RestaurantTable[];
  selectedTableId: string | null;
  gridSize: number;
  onSelectTable: (tableId: string | null) => void;
  onMoveTable: (tableId: string, x: number, y: number) => void;
}

export function FloorPlanCanvas({
  tables,
  selectedTableId,
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
    <div className="relative flex-1 overflow-auto bg-bg-canvas p-3 sm:p-6">
      <div
        className="mx-auto rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-token-sm)]"
        style={{
          width: "100%",
          maxWidth: CANVAS_WIDTH + 48,
          // Below this width the plan would shrink to an unusable, illegible
          // size on a phone — floor it here and let the wrapper's
          // `overflow-auto` handle panning instead (see touch-action below).
          minWidth: 600,
          aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="h-full w-full touch-pan-x touch-pan-y"
          onPointerDown={() => onSelectTable(null)}
        >
          <defs>
            <pattern id="floor-grid-dots" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} className="fill-[var(--canvas-dot)]" />
            </pattern>

            {/* Wood finish for every table — defined once here, reused by
                every `TableShape` via `fill="url(#...)"` so the cost is one
                gradient/pattern regardless of table count (see DESIGN.md,
                Floor plan editor). Deliberately transparent at its own
                center (0% stop-opacity 0) so a table's status-coloured fill,
                where the label text sits, is left exactly as before —
                the wood only becomes visible toward the rim. */}
            <radialGradient id="wood-grain-sheen" cx="38%" cy="32%" r="72%">
              <stop offset="0%" style={{ stopColor: "var(--wood-grain-1)", stopOpacity: 0 }} />
              <stop offset="45%" style={{ stopColor: "var(--wood-grain-2)", stopOpacity: 0.22 }} />
              <stop offset="80%" style={{ stopColor: "var(--wood-grain-3)", stopOpacity: 0.5 }} />
              <stop offset="100%" style={{ stopColor: "var(--wood-rim)", stopOpacity: 0.68 }} />
            </radialGradient>
            <pattern id="wood-grain-lines" width={34} height={34} patternUnits="userSpaceOnUse" patternTransform="rotate(6)">
              <path d="M0 6 Q17 2 34 7" stroke="var(--wood-rim)" strokeWidth={1} fill="none" opacity={0.5} />
              <path d="M0 17 Q17 13 34 18" stroke="var(--wood-rim)" strokeWidth={0.75} fill="none" opacity={0.35} />
              <path d="M0 28 Q17 24 34 29" stroke="var(--wood-grain-1)" strokeWidth={0.75} fill="none" opacity={0.4} />
            </pattern>
          </defs>
          <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} rx={24} fill="url(#floor-grid-dots)" />

          {tables.map((table) => (
            <TableShape
              key={table.id}
              table={table}
              selected={table.id === selectedTableId}
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
