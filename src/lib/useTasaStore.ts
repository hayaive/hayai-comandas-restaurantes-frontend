import { create } from "zustand";
import { api, ApiError } from "@/api";
import type { DivisaTasa, TasaVigente } from "@/api";

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
  /** Igual que `refreshing`, pero para la corrección manual (`POST /tasa`, fuente 'manual'). */
  guardando: boolean;
  error: string | null;

  load: () => Promise<void>;
  /** Fuerza `POST /tasa/actualizar` (fetch inmediato desde la fuente externa). */
  actualizar: () => Promise<void>;
  /**
   * Corrección manual del dueño: `POST /tasa` con `fuente: 'manual'` para UNA
   * divisa puntual, y recarga `vigente` para que la barra refleje el nuevo
   * valor de una vez. Relanza el error (además de dejarlo en `error`) para
   * que el formulario que llamó pueda mostrarlo junto al input que falló.
   */
  guardarManual: (valor: number, divisa: DivisaTasa) => Promise<void>;
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
  guardando: false,
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

  guardarManual: async (valor: number, divisa: DivisaTasa) => {
    set({ guardando: true, error: null });
    try {
      await api.registrarTasa(valor, "manual", divisa);
      const vigente = await api.getTasaVigente();
      set({ vigente, status: "ready" });
    } catch (error) {
      set({ error: messageOf(error) });
      throw error;
    } finally {
      set({ guardando: false });
    }
  },
}));
