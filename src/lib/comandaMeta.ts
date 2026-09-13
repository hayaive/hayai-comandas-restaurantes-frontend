import type { EstadoComanda, EstadoComandaItem } from "@/api";

type Tone = "neutral" | "accent" | "free" | "reserved" | "occupied";

interface Meta {
  label: string;
  tone: Tone;
}

/**
 * Comanda/item states reuse the same Badge tones as table status (free =
 * emerald, reserved = amber, occupied/danger-adjacent kept separate) instead
 * of inventing new colors — see `src/components/floor-plan/statusMeta.ts`
 * for the source of truth on that palette.
 */
export const COMANDA_ITEM_META: Record<EstadoComandaItem, Meta> = {
  pendiente: { label: "Pendiente", tone: "reserved" },
  en_preparacion: { label: "En preparación", tone: "accent" },
  servido: { label: "Servido", tone: "free" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export const COMANDA_ITEM_ORDER: EstadoComandaItem[] = ["pendiente", "en_preparacion", "servido"];

export const COMANDA_ESTADO_META: Record<EstadoComanda, Meta> = {
  abierta: { label: "Abierta", tone: "accent" },
  por_cobrar: { label: "Por cobrar", tone: "reserved" },
  cobrada: { label: "Cobrada", tone: "free" },
  anulada: { label: "Anulada", tone: "neutral" },
};
