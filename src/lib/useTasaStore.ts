import { create } from "zustand";
import { api, ApiError } from "@/api";
import type { TasaVigente } from "@/api";

/**
 * Tasa BCV (USD) y Euro vigentes, compartida por toda la app — el mesero la
 * necesita en cualquier pantalla, no sólo donde se registra o se cobra. Un
 * solo store evita pedir `GET /tasa/vigente` por cada componente que muestra
 * un precio dual.
 */
interface TasaState {
  vigente: TasaVigente | null;
  status: "idle" | "loading" | "ready" | "error";
  /** Aparte de `status`: refrescar no debe tapar el valor ya cargado con un loader. */
  refreshing: boolean;
  error: string | null;

  load: () => Promise<void>;
  /** Fuerza `POST /tasa/actualizar` (fetch inmediato desde la fuente externa). */
  actualizar: () => Promise<void>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

export const useTasaStore = create<TasaState>((set, get) => ({
  vigente: null,
  status: "idle",
  refreshing: false,
  error: null,

  load: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const vigente = await api.getTasaVigente();
      set({ vigente, status: "ready" });
    } catch (error) {
      set({ status: "error", error: messageOf(error) });
    }
  },

  actualizar: async () => {
    set({ refreshing: true, error: null });
    try {
      const vigente = await api.actualizarTasa();
      set({ vigente, status: "ready" });
    } catch (error) {
      set({ error: messageOf(error) });
    } finally {
      set({ refreshing: false });
    }
  },
}));
