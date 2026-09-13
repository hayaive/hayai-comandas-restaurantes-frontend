import type { TableStatus } from "@/lib/types";

export const STATUS_ORDER: TableStatus[] = ["free", "reserved", "occupied"];

interface StatusMeta {
  label: string;
  /** SVG-only: use on <circle>/<rect> inside the canvas. */
  svgFillClass: string;
  svgStrokeClass: string;
  /** HTML-only: use on <div>/<span>/<button> outside the canvas. */
  dotClass: string;
  bgSoftClass: string;
  borderClass: string;
  textClass: string;
}

export const STATUS_META: Record<TableStatus, StatusMeta> = {
  free: {
    label: "Libre",
    svgFillClass: "fill-status-free-soft",
    svgStrokeClass: "stroke-status-free",
    dotClass: "bg-status-free",
    bgSoftClass: "bg-status-free-soft",
    borderClass: "border-status-free",
    textClass: "text-status-free-fg",
  },
  reserved: {
    label: "Reservada",
    svgFillClass: "fill-status-reserved-soft",
    svgStrokeClass: "stroke-status-reserved",
    dotClass: "bg-status-reserved",
    bgSoftClass: "bg-status-reserved-soft",
    borderClass: "border-status-reserved",
    textClass: "text-status-reserved-fg",
  },
  occupied: {
    label: "Ocupada",
    svgFillClass: "fill-status-occupied-soft",
    svgStrokeClass: "stroke-status-occupied",
    dotClass: "bg-status-occupied",
    bgSoftClass: "bg-status-occupied-soft",
    borderClass: "border-status-occupied",
    textClass: "text-status-occupied-fg",
  },
};
