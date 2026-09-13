import type { TableShape } from "@/lib/types";

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 700;
const SEAT_GAP = 16;
const SEAT_RADIUS = 7;

export interface Point {
  x: number;
  y: number;
}

export interface SeatPosition extends Point {
  /**
   * Degrees to rotate a chair icon — authored pointing "outward" (its
   * backrest away from the table, at local angle 0) — so this seat's
   * backrest faces away from the table and its pad faces the table, matching
   * where it sits around the shape. Exact for square tables (one of the four
   * edge normals); derived from the seat's own radial position for circular
   * ones, which is equivalent.
   */
  angle: number;
}

/** Outward-facing rotation (degrees) for a chair whose backrest, undrawn,
 * points "up" (local -y) by default, given its position's direction from the
 * table's own center (0,0). */
function outwardAngleDeg(x: number, y: number): number {
  return (Math.atan2(x, -y) * 180) / Math.PI;
}

/** Seat positions (plus outward angle), relative to the table's own center (0,0). */
export function getSeatPositions(shape: TableShape, size: number, seats: number): SeatPosition[] {
  if (seats <= 0) return [];
  return shape === "circle"
    ? circleSeatPositions(size, seats)
    : squareSeatPositions(size, seats);
}

function circleSeatPositions(size: number, seats: number): SeatPosition[] {
  const radius = size / 2 + SEAT_GAP;
  const points: SeatPosition[] = [];
  for (let i = 0; i < seats; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / seats;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    points.push({ x, y, angle: outwardAngleDeg(x, y) });
  }
  return points;
}

function squareSeatPositions(size: number, seats: number): SeatPosition[] {
  const half = size / 2 + SEAT_GAP;
  const side = half * 2;
  const perimeter = side * 4;
  const points: SeatPosition[] = [];

  for (let i = 0; i < seats; i += 1) {
    // Start at top-middle, walk clockwise.
    const d = (perimeter * i) / seats + side / 2;
    const wrapped = d % perimeter;
    points.push(pointOnSquarePerimeter(wrapped, half, side));
  }
  return points;
}

function pointOnSquarePerimeter(d: number, half: number, side: number): SeatPosition {
  if (d < side) {
    // top edge, left -> right; outward normal points up.
    return { x: -half + d, y: -half, angle: 0 };
  }
  if (d < side * 2) {
    // right edge, top -> bottom; outward normal points right.
    return { x: half, y: -half + (d - side), angle: 90 };
  }
  if (d < side * 3) {
    // bottom edge, right -> left; outward normal points down.
    return { x: half - (d - side * 2), y: half, angle: 180 };
  }
  // left edge, bottom -> top; outward normal points left.
  return { x: -half, y: half - (d - side * 3), angle: -90 };
}

export { SEAT_RADIUS };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
