import type { TableShape } from "@/lib/types";

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 700;
const SEAT_GAP = 16;
const SEAT_RADIUS = 7;

export interface Point {
  x: number;
  y: number;
}

/** Seat positions, relative to the table's own center (0,0). */
export function getSeatPositions(shape: TableShape, size: number, seats: number): Point[] {
  if (seats <= 0) return [];
  return shape === "circle"
    ? circleSeatPositions(size, seats)
    : squareSeatPositions(size, seats);
}

function circleSeatPositions(size: number, seats: number): Point[] {
  const radius = size / 2 + SEAT_GAP;
  const points: Point[] = [];
  for (let i = 0; i < seats; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / seats;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return points;
}

function squareSeatPositions(size: number, seats: number): Point[] {
  const half = size / 2 + SEAT_GAP;
  const side = half * 2;
  const perimeter = side * 4;
  const points: Point[] = [];

  for (let i = 0; i < seats; i += 1) {
    // Start at top-middle, walk clockwise.
    const d = (perimeter * i) / seats + side / 2;
    const wrapped = d % perimeter;
    points.push(pointOnSquarePerimeter(wrapped, half, side));
  }
  return points;
}

function pointOnSquarePerimeter(d: number, half: number, side: number): Point {
  if (d < side) {
    // top edge, left -> right
    return { x: -half + d, y: -half };
  }
  if (d < side * 2) {
    // right edge, top -> bottom
    return { x: half, y: -half + (d - side) };
  }
  if (d < side * 3) {
    // bottom edge, right -> left
    return { x: half - (d - side * 2), y: half };
  }
  // left edge, bottom -> top
  return { x: -half, y: half - (d - side * 3) };
}

export { SEAT_RADIUS };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
