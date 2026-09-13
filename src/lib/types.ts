/**
 * Domain types for the floor plan editor.
 *
 * Kept intentionally small and backend-agnostic: no field here
 * assumes a specific persistence shape. When the real API lands,
 * these types are the contract to adapt `useFloorPlanStore`
 * against — the canvas and panel components should not need to
 * change.
 */

export type TableShape = "circle" | "square";

export type TableStatus = "free" | "reserved" | "occupied";

export interface RestaurantTable {
  id: string;
  /** Short label shown on the table, e.g. "M-12" or "Terraza 3". */
  label: string;
  shape: TableShape;
  /** Center position, in canvas units (0-1000 on each axis). */
  x: number;
  y: number;
  /** Visual size in canvas units; seats are drawn around this. */
  size: number;
  seats: number;
  status: TableStatus;
  /** Name of the reserving/occupying guest. Empty when status is "free". */
  occupantName?: string;
}

export interface FloorPlanTemplate {
  id: string;
  name: string;
  tables: RestaurantTable[];
}
