import { create } from "zustand";
import { api, ApiError } from "@/api";
import type { Comanda, EstadoComandaItem } from "@/api";
import { useFloorPlanStore } from "./useFloorPlanStore";

/**
 * Comandas activas, one per occupied table.
 *
 * This store does not own table occupancy — `useFloorPlanStore` (the floor
 * plan editor's store, untouched here) is still the single source of truth
 * for which tables are free/reserved/occupied. `useSyncComandasWithFloorPlan`
 * below is the seam: it watches the active template's occupied tables and
 * opens/closes a comanda to match, so the comandas panel updates live when a
 * host changes a table's status from the floor plan editor, and `cobrarYLiberar`
 * frees the table back when a bill is paid.
 */

interface ComandaState {
  comandas: Comanda[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  load: () => Promise<void>;
  ensureComandaForTable: (mesaId: string, mesaEtiqueta: string, clienteNombre?: string) => Promise<void>;
  releaseComandaForTable: (mesaId: string) => Promise<void>;
  /** Registers a comanda already created server-side (e.g. by a reservation check-in), without calling the API again. */
  registerComanda: (comanda: Comanda) => void;
  addItem: (comandaId: string, productoId: string, cantidad: number, nota?: string) => Promise<void>;
  setItemEstado: (comandaId: string, itemId: string, estado: EstadoComandaItem) => Promise<void>;
  removeItem: (comandaId: string, itemId: string, motivo: string) => Promise<void>;
  pedirCuenta: (comandaId: string) => Promise<void>;
  cobrarYLiberar: (comandaId: string) => Promise<void>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

const creationLocks = new Set<string>();

export const useComandaStore = create<ComandaState>((set, get) => ({
  comandas: [],
  status: "idle",
  error: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const comandas = await api.listComandasActivas();
      set({ comandas, status: "ready" });
    } catch (error) {
      set({ status: "error", error: messageOf(error) });
    }
  },

  ensureComandaForTable: async (mesaId, mesaEtiqueta, clienteNombre) => {
    const already = get().comandas.some((c) => c.mesaId === mesaId);
    if (already || creationLocks.has(mesaId)) return;
    creationLocks.add(mesaId);
    try {
      const comanda = await api.createComanda({ mesaId, mesaEtiqueta, clienteNombre });
      set({ comandas: [...get().comandas, comanda] });
    } catch (error) {
      set({ error: messageOf(error) });
    } finally {
      creationLocks.delete(mesaId);
    }
  },

  registerComanda: (comanda) => {
    if (get().comandas.some((c) => c.id === comanda.id)) return;
    set({ comandas: [...get().comandas, comanda] });
  },

  releaseComandaForTable: async (mesaId) => {
    const comanda = get().comandas.find((c) => c.mesaId === mesaId);
    if (!comanda) return;
    set({ comandas: get().comandas.filter((c) => c.id !== comanda.id) });
    try {
      await api.anularComanda(comanda.id, "Mesa liberada manualmente desde el editor de plano");
    } catch (error) {
      set({ error: messageOf(error) });
    }
  },

  addItem: async (comandaId, productoId, cantidad, nota) => {
    const items = await api.addComandaItems(comandaId, [{ productoId, cantidad, nota }]);
    set({
      comandas: get().comandas.map((c) =>
        c.id === comandaId
          ? {
              ...c,
              items: [...c.items, ...items],
              total: (Number(c.total) + items.reduce((s, i) => s + Number(i.totalLinea), 0)).toFixed(2),
            }
          : c,
      ),
    });
  },

  setItemEstado: async (comandaId, itemId, estado) => {
    const updated = await api.setComandaItemEstado(comandaId, itemId, estado);
    set({
      comandas: get().comandas.map((c) =>
        c.id === comandaId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? updated : i)) }
          : c,
      ),
    });
  },

  removeItem: async (comandaId, itemId, motivo) => {
    await api.removeComandaItem(comandaId, itemId, motivo);
    set({
      comandas: get().comandas.map((c) =>
        c.id === comandaId
          ? {
              ...c,
              items: c.items.map((i) => (i.id === itemId ? { ...i, estado: "cancelado" as const } : i)),
            }
          : c,
      ),
    });
  },

  pedirCuenta: async (comandaId) => {
    const updated = await api.pedirCuenta(comandaId);
    set({ comandas: get().comandas.map((c) => (c.id === comandaId ? updated : c)) });
  },

  cobrarYLiberar: async (comandaId) => {
    const comanda = get().comandas.find((c) => c.id === comandaId);
    if (!comanda) return;
    await api.cobrarComanda(comandaId);
    set({ comandas: get().comandas.filter((c) => c.id !== comandaId) });
    useFloorPlanStore.getState().setStatus(comanda.mesaId, "free");
  },
}));

export function useComandaForTable(mesaId: string): Comanda | undefined {
  return useComandaStore((state) => state.comandas.find((c) => c.mesaId === mesaId));
}
