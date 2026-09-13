import { create } from "zustand";
import { api, ApiError } from "@/api";
import type { Comanda, EstadoComandaItem } from "@/api";
import { useFloorPlanStore } from "./useFloorPlanStore";

/**
 * Comandas activas, una por mesa ocupada.
 *
 * La ocupación de una mesa NO se decide aquí ni en el editor de plano: la
 * calcula el backend (vista `v_mesa_estado`, expuesta en `GET /plano`), y una
 * mesa está ocupada exactamente cuando tiene una comanda viva. Por eso cada
 * acción de este store que cambia esa condición —abrir, anular o cobrar—
 * hace dos cosas: actualiza el plano de forma optimista para que la UI
 * responda al instante, y después pide `refreshPlano()` para reconciliar con
 * lo que el servidor realmente tiene.
 */

/**
 * El backend rechaza el cobro mientras el restaurante no tenga registrada la
 * tasa del día: cobrar congela `tasaValor`/`totalBs` en la comanda, así que sin
 * tasa no hay cierre posible. No es un fallo técnico sino un paso operativo que
 * falta, y por eso se distingue del resto de errores: la UI lo resuelve
 * pidiendo la tasa, no mostrando un mensaje rojo.
 */
export class TasaRequeridaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TasaRequeridaError";
  }
}

function esFaltaDeTasa(error: unknown): boolean {
  return error instanceof ApiError && /tasa de cambio/i.test(error.message);
}

interface ComandaState {
  comandas: Comanda[];
  /** Comandas ya cobradas del día operativo — alimentan el histórico de Ventas. */
  cobradasHoy: Comanda[];
  /**
   * `false` cuando el backend no sabe listar el histórico y lo único que se ve
   * son los cobros hechos en esta sesión. Ventas lo dice explícitamente en vez
   * de hacer pasar una lista incompleta por el histórico del día.
   */
  historicoCompleto: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  load: () => Promise<void>;
  loadCobradas: (fecha: string) => Promise<void>;
  ensureComandaForTable: (mesaId: string, mesaEtiqueta: string, clienteNombre?: string) => Promise<void>;
  releaseComandaForTable: (mesaId: string) => Promise<void>;
  /** Registers a comanda already created server-side (e.g. by a reservation check-in), without calling the API again. */
  registerComanda: (comanda: Comanda) => void;
  addItem: (comandaId: string, productoId: string, cantidad: number, nota?: string) => Promise<void>;
  setItemEstado: (comandaId: string, itemId: string, estado: EstadoComandaItem) => Promise<void>;
  removeItem: (comandaId: string, itemId: string, motivo: string) => Promise<void>;
  /**
   * Cobra la comanda completa y libera la mesa. Lanza `TasaRequeridaError` si
   * falta la tasa del día, para que la tarjeta pueda pedirla y reintentar.
   */
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
  cobradasHoy: [],
  historicoCompleto: true,
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

  loadCobradas: async (fecha) => {
    const delBackend = await api.listComandasCobradas(fecha);
    if (delBackend === null) {
      // Sin endpoint de histórico: se conserva lo cobrado en esta sesión.
      set({ historicoCompleto: false });
      return;
    }
    // El backend manda la verdad completa; lo de la sesión ya viene incluido.
    set({ cobradasHoy: delBackend, historicoCompleto: true });
  },

  ensureComandaForTable: async (mesaId, mesaEtiqueta, clienteNombre) => {
    const already = get().comandas.some((c) => c.mesaId === mesaId);
    if (already || creationLocks.has(mesaId)) return;
    creationLocks.add(mesaId);
    try {
      const comanda = await api.createComanda({ mesaId, mesaEtiqueta, clienteNombre });
      set({ comandas: [...get().comandas, comanda] });
      // La mesa acaba de pasar a "ocupada" server-side: reconcilia el plano.
      void useFloorPlanStore.getState().refreshPlano();
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
      void useFloorPlanStore.getState().refreshPlano();
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

  cobrarYLiberar: async (comandaId) => {
    const comanda = get().comandas.find((c) => c.id === comandaId);
    if (!comanda) return;

    // Un solo pago en efectivo USD por el total: es el caso normal y lo que
    // significa el botón "Cobrar y cerrar". Un cobro mixto o en Bs necesita
    // elegir método, y eso es una pantalla de caja que todavía no existe.
    const total = Number(comanda.total);
    let cobrada: Comanda;
    try {
      cobrada = await api.cobrarComanda(comandaId, {
        pagos: [{ metodo: "efectivo_usd", moneda: "USD", monto: total }],
      });
    } catch (error) {
      if (esFaltaDeTasa(error)) throw new TasaRequeridaError(messageOf(error));
      throw error;
    }

    set({
      comandas: get().comandas.filter((c) => c.id !== comandaId),
      // La comanda cobrada sale del panel y pasa al histórico del día.
      cobradasHoy: [cobrada, ...get().cobradasHoy.filter((c) => c.id !== cobrada.id)],
    });
    // Optimista primero (la UI no debe esperar al round-trip), reconciliación después.
    useFloorPlanStore.getState().setStatus(comanda.mesaId, "free");
    void useFloorPlanStore.getState().refreshPlano();
  },
}));

export function useComandaForTable(mesaId: string): Comanda | undefined {
  return useComandaStore((state) => state.comandas.find((c) => c.mesaId === mesaId));
}
