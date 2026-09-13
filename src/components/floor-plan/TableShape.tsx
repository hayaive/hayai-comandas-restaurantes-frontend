import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { RestaurantTable } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CANVAS_HEIGHT, CANVAS_WIDTH, SEAT_RADIUS, clamp, getSeatPositions, type Point } from "./geometry";
import { STATUS_META } from "./statusMeta";

interface TableShapeProps {
  table: RestaurantTable;
  selected: boolean;
  toCanvasPoint: (clientX: number, clientY: number) => Point;
  onSelect: (tableId: string) => void;
  onMove: (tableId: string, x: number, y: number) => void;
}

const KEYBOARD_STEP = 8;

/**
 * Client-space pixels of pointer travel before a press becomes a drag rather
 * than a tap. Below this, `onSelect` fires on release (opens the inspector /
 * mobile sheet); at or above it, the gesture moves the table and never
 * selects. Without this split, `onSelect` used to fire on `pointerdown`
 * itself, so on mobile — where selecting opens a full-screen sheet — every
 * attempt to drag a table instead popped the sheet open before the finger
 * had moved at all.
 */
const DRAG_THRESHOLD = 6;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function TableShape({
  table,
  selected,
  toCanvasPoint,
  onSelect,
  onMove,
}: TableShapeProps) {
  const dragOffset = useRef<Point | null>(null);
  /** Client-space coords where this pointer gesture started; null when none is in progress. */
  const pointerStart = useRef<Point | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const status = STATUS_META[table.status];
  const half = table.size / 2;
  const seatPositions = getSeatPositions(table.shape, table.size, table.seats);

  function moveTo(nextX: number, nextY: number) {
    const clampedX = clamp(nextX, half, CANVAS_WIDTH - half);
    const clampedY = clamp(nextY, half, CANVAS_HEIGHT - half);
    onMove(table.id, clampedX, clampedY);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    // Selection is decided on release, not here — see DRAG_THRESHOLD above.
    pointerStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGGElement>) {
    if (!pointerStart.current) return;

    if (!isDragging) {
      const dx = event.clientX - pointerStart.current.x;
      const dy = event.clientY - pointerStart.current.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Just crossed the threshold: anchor the offset to the CURRENT pointer
      // position (not the original press point) so the table does not jump
      // to catch up the moment the drag "activates".
      setDragging(true);
      const point = toCanvasPoint(event.clientX, event.clientY);
      dragOffset.current = { x: point.x - table.x, y: point.y - table.y };
    }

    if (!dragOffset.current) return;
    const point = toCanvasPoint(event.clientX, event.clientY);
    moveTo(point.x - dragOffset.current.x, point.y - dragOffset.current.y);
  }

  function endDrag(event: ReactPointerEvent<SVGGElement>) {
    if (!pointerStart.current) return;
    const wasDragging = isDragging;
    const wasCancelled = event.type === "pointercancel";
    pointerStart.current = null;
    dragOffset.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // A tap selects (opens the inspector / mobile sheet); a completed drag
    // does not — repositioning a table is a complete action on its own, and
    // selecting right after would reopen the sheet the user just dragged to
    // get away from.
    if (!wasDragging && !wasCancelled) {
      onSelect(table.id);
    }
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect(table.id);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveTo(table.x, table.y - KEYBOARD_STEP);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveTo(table.x, table.y + KEYBOARD_STEP);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveTo(table.x - KEYBOARD_STEP, table.y);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveTo(table.x + KEYBOARD_STEP, table.y);
        break;
      default:
        break;
    }
  }

  return (
    <g
      transform={`translate(${table.x} ${table.y})`}
      tabIndex={0}
      role="button"
      aria-label={`Mesa ${table.label}, ${table.seats} sillas, ${status.label.toLowerCase()}`}
      className={cn(
        "cursor-grab touch-none outline-none",
        isDragging && "cursor-grabbing",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {/* Seats */}
      {seatPositions.map((seat, index) => (
        <circle
          key={index}
          cx={seat.x}
          cy={seat.y}
          r={SEAT_RADIUS}
          className={cn(
            "stroke-border-strong transition-colors duration-150",
            selected ? "fill-active-soft" : "fill-surface",
          )}
          strokeWidth={1.5}
        />
      ))}

      {/* Table body */}
      {table.shape === "circle" ? (
        <circle
          r={half}
          className={cn(status.svgFillClass, status.svgStrokeClass, "transition-[filter] duration-150")}
          strokeWidth={selected ? 3 : 2}
        />
      ) : (
        <rect
          x={-half}
          y={-half}
          width={table.size}
          height={table.size}
          rx={12}
          className={cn(status.svgFillClass, status.svgStrokeClass)}
          strokeWidth={selected ? 3 : 2}
        />
      )}

      {/* Selection ring — also shown while dragging (local state), so moving
          an unselected table still gives a clear "this is the one I'm
          holding" cue even before `onSelect` fires on release. */}
      {(selected || isFocused || isDragging) && (
        <>
          {table.shape === "circle" ? (
            <circle
              r={half + 7}
              className="fill-none stroke-active"
              strokeWidth={2.5}
              strokeDasharray={isFocused && !selected && !isDragging ? "4 4" : undefined}
            />
          ) : (
            <rect
              x={-half - 7}
              y={-half - 7}
              width={table.size + 14}
              height={table.size + 14}
              rx={16}
              className="fill-none stroke-active"
              strokeWidth={2.5}
              strokeDasharray={isFocused && !selected && !isDragging ? "4 4" : undefined}
            />
          )}
        </>
      )}

      {/* Label + seat count */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={table.seats > 0 ? -7 : 0}
        className="select-none fill-fg font-mono text-[15px] font-semibold"
      >
        {table.label}
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={11}
        className="select-none fill-fg-muted font-mono text-[10.5px]"
      >
        {"×"}
        {table.seats}
      </text>

      {/* Occupant name */}
      {table.status !== "free" && table.occupantName && (
        <text
          textAnchor="middle"
          y={half + 20}
          className={cn(
            "select-none text-[11px] font-medium",
            table.status === "reserved" ? "fill-status-reserved-fg" : "fill-status-occupied-fg",
          )}
        >
          {truncate(table.occupantName, 18)}
        </text>
      )}
    </g>
  );
}
