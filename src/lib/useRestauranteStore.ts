import { useEffect } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/api";
import type { Restaurante, UpdateRestauranteInput } from "@/api";

/**
 * Configuración del negocio (`GET /restaurante`), compartida por toda la
 * app — igual que `useTasaStore`: se carga UNA vez y de ahí en adelante
 * cualquier pantalla lee `nombre`/`logoUrl`/`mostrarPreciosEn` de aquí en vez
 * de pedirlo por su cuenta. El bootstrap vive en `AppShell`, junto a los
 * demás (`useTasaBootstrap`, `useFloorPlanBootstrap`, …).
 */
interface RestauranteState {
  restaurante: Restaurante | null;
  status: "idle" | "loading" | "ready" | "error";
  /** Aparte de `status`: guardar un cambio no debe tapar el formulario con un loader de pantalla completa. */
  guardando: boolean;
  error: string | null;

  load: () => Promise<void>;
  /**
   * `PATCH /restaurante`. El backend devuelve el objeto COMPLETO y el store
   * se reemplaza con esa respuesta — nunca con un merge local optimista —
   * para que quede exactamente lo que el servidor persistió (p. ej. el
   * nombre ya recortado por el CHECK `restaurante_nombre_acotado`). Relanza
   * el error (además de dejarlo en `error`) para que la pantalla que llamó
   * pueda mostrarlo junto al campo que falló.
   */
  update: (input: UpdateRestauranteInput) => Promise<void>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

export const useRestauranteStore = create<RestauranteState>((set, get) => ({
  restaurante: null,
  status: "idle",
  guardando: false,
  error: null,

  load: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const restaurante = await api.getRestaurante();
      set({ restaurante, status: "ready" });
    } catch (error) {
      set({ status: "error", error: messageOf(error) });
    }
  },

  update: async (input) => {
    set({ guardando: true, error: null });
    try {
      const restaurante = await api.updateRestaurante(input);
      set({ restaurante, status: "ready" });
    } catch (error) {
      set({ error: messageOf(error) });
      throw error;
    } finally {
      set({ guardando: false });
    }
  },
}));

/** Se monta una vez en `AppShell`. Ver `useTasaBootstrap` para el mismo patrón. */
export function useRestauranteBootstrap(): void {
  const status = useRestauranteStore((state) => state.status);
  const load = useRestauranteStore((state) => state.load);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
}
