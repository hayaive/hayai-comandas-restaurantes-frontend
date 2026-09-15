import type { DestinoPreparacion, EstadoComanda } from "@/api";

type Tone = "neutral" | "accent" | "free" | "reserved" | "occupied";

interface Meta {
  label: string;
  tone: Tone;
}

/**
 * Estados de comanda con las mismas tonalidades de Badge que el estado de
 * mesa, en vez de inventar colores nuevos — ver
 * `src/components/floor-plan/statusMeta.ts`, que es la fuente de verdad de esa
 * paleta.
 *
 * ⚠️ Ya no hay `COMANDA_ITEM_META`: el workflow por ítem
 * (`pendiente`/`en_preparacion`/`servido`) desapareció con el rediseño. Una
 * línea sólo puede estar viva o anulada, y eso se lee de `canceladoEn`.
 */
export const COMANDA_ESTADO_META: Record<EstadoComanda, Meta> = {
  pendiente: { label: "En cocina", tone: "reserved" },
  despachada: { label: "Despachada", tone: "accent" },
  cobrada: { label: "Cobrada", tone: "free" },
  anulada: { label: "Anulada", tone: "neutral" },
};

/** Dónde se prepara una línea. `ninguno` no se rotula: no aporta nada. */
export const DESTINO_META: Record<DestinoPreparacion, Meta | null> = {
  cocina: { label: "Cocina", tone: "occupied" },
  barra: { label: "Barra", tone: "accent" },
  ninguno: null,
};
