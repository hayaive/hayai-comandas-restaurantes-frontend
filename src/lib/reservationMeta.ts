import type { EstadoReservacion } from "@/api";

type Tone = "neutral" | "accent" | "free" | "reserved" | "occupied";

export const RESERVATION_ESTADO_META: Record<EstadoReservacion, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "reserved" },
  confirmada: { label: "Confirmada", tone: "accent" },
  sentada: { label: "Sentada", tone: "free" },
  completada: { label: "Completada", tone: "neutral" },
  cancelada: { label: "Cancelada", tone: "occupied" },
  no_show: { label: "No show", tone: "occupied" },
};
