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
    // Defensive against mobile browsers stealing the gesture as a scroll/pan
    // of an ancestor (the canvas wrapper's `overflow-auto`, or the `<svg>`'s
    // own `touch-pan-x touch-pan-y`) before `pointermove` below gets a chance
    // to cross `DRAG_THRESHOLD`. `touch-none` on this `<g>` should already
    // stop that per the touch-action spec, but historically WebKit/Safari on
    // iOS has been inconsistent about honouring `touch-action` on SVG child
    // elements — `preventDefault()` inside a non-passive React pointer
    // handler is the mechanism the spec defines for suppressing default touch
    // behaviour, and it does not depend on that support, so keep both.
    event.preventDefault();
    // `preventDefault()` on pointerdown also suppresses the browser's default
    // "focus the target" behaviour, so restore it explicitly — otherwise a
    // tap/click on a table would stop moving focus there, breaking the
    // keyboard focus-visible ring below.
    event.currentTarget.focus();
    // Selection is decided on release, not here — see DRAG_THRESHOLD above.
    pointerStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGGElement>) {
    if (!pointerStart.current) return;
    // Same defensive preventDefault as pointerdown, for the same reason —
    // keeps a live drag from being aborted mid-gesture by a browser that
    // decides midway through to start scrolling instead.
    event.preventDefault();

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
      {/* Seats — top-down wooden chairs: a seat pad plus a backrest rail
          facing away from the table, rotated per seat to the outward angle
          `geometry.ts` computes for its position (exact for a square table's
          four edges, equivalent for a circular one). Selected keeps the
          existing brown `fill-active-soft` + neutral outline unchanged;
          unselected now reads as chair wood instead of an empty ring. */}
      {seatPositions.map((seat, index) => (
        <g key={index} transform={`translate(${seat.x} ${seat.y}) rotate(${seat.angle})`}>
          <rect
            x={-SEAT_RADIUS * 0.62}
            y={-SEAT_RADIUS * 1.9}
            width={SEAT_RADIUS * 1.24}
            height={SEAT_RADIUS * 0.8}
            rx={SEAT_RADIUS * 0.35}
            className={cn(
              "transition-colors duration-150",
              selected ? "fill-active-soft stroke-border-strong" : "fill-wood-seat stroke-wood-seat-rim",
            )}
            strokeWidth={1}
          />
          <rect
            x={-SEAT_RADIUS * 0.82}
            y={-SEAT_RADIUS * 0.82}
            width={SEAT_RADIUS * 1.64}
            height={SEAT_RADIUS * 1.64}
            rx={SEAT_RADIUS * 0.55}
            className={cn(
              "transition-colors duration-150",
              selected ? "fill-active-soft stroke-border-strong" : "fill-wood-seat stroke-wood-seat-rim",
            )}
            strokeWidth={1.25}
          />
        </g>
      ))}

      {/* Table body. Status fill/stroke are untouched — same classes as
          before, still the primary "what state is this" signal — with a
          wood finish layered on top: a radial sheen that stays fully
          transparent at the very center (where the label text sits, so its
          contrast is exactly what it always audited to) and only becomes
          visible toward the rim, plus a low-opacity grain-line texture. */}
      {table.shape === "circle" ? (
        <>
          <circle
            r={half}
            className={cn(status.svgFillClass, status.svgStrokeClass, "transition-[filter] duration-150")}
            strokeWidth={selected ? 3 : 2}
          />
          <circle r={half} fill="url(#wood-grain-sheen)" className="pointer-events-none" />
          <circle r={half} fill="url(#wood-grain-lines)" opacity={0.5} className="pointer-events-none" />
        </>
      ) : (
        <>
          <rect
            x={-half}
            y={-half}
            width={table.size}
            height={table.size}
            rx={12}
            className={cn(status.svgFillClass, status.svgStrokeClass)}
            strokeWidth={selected ? 3 : 2}
          />
          <rect
            x={-half}
            y={-half}
            width={table.size}
            height={table.size}
            rx={12}
            fill="url(#wood-grain-sheen)"
            className="pointer-events-none"
          />
          <rect
            x={-half}
            y={-half}
            width={table.size}
            height={table.size}
            rx={12}
            fill="url(#wood-grain-lines)"
            opacity={0.5}
            className="pointer-events-none"
          />
        </>
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

      {/* Label + seat count.
          Font size is a `viewBox` unit like everything else here, so it
          shrinks with the canvas exactly as the tables and chairs do (see
          `FloorPlanCanvas.tsx`'s note on removing `minWidth` below `md`).
          Below `md` the canvas can now go all the way down to a phone's full
          width instead of the old 600px floor, which would otherwise make
          this text render far smaller on screen than before — bumped here as
          a legibility floor for that case specifically (viewport-breakpoint
          based, not actual-container-width based, since the SVG has no
          container queries to key off; unverified on a real device). */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={table.seats > 0 ? -7 : 0}
        className="select-none fill-fg font-mono text-[19px] font-semibold md:text-[15px]"
      >
        {table.label}
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={11}
        className="select-none fill-fg-muted font-mono text-[13px] md:text-[10.5px]"
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
            "select-none text-[13.5px] font-medium md:text-[11px]",
            table.status === "reserved" ? "fill-status-reserved-fg" : "fill-status-occupied-fg",
          )}
        >
          {truncate(table.occupantName, 18)}
        </text>
      )}
    </g>
  );
}
