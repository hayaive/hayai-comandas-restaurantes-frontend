import { create } from "zustand";
import { api, ApiError } from "@/api";
import type {
  AccesoCreadoResult,
  AccesoTemporal,
  AccesoVencimientos,
  CreateAccesoInput,
  RegenerarAccesoInput,
  RegenerarAccesoResult,
  UpdateAccesoInput,
} from "@/api";

/**
 * Accesos temporales de meseros (`/meseros`, sólo administrador).
 *
 * Sigue el mismo patrón que `useProductStore`/`useReservationStore`: un
 * store por pantalla, `status` para el primer arranque, sin loader propio en
 * las mutaciones (la UI decide su propio `busy` local, ver `MeserosPage`).
 *
 * OJO con `enlace`/`codigo`: el contrato es tajante en que sólo se ven UNA
 * vez, en la respuesta de `createAcceso`/`regenerarAcceso`. Este store nunca
 * los guarda — `crear`/`regenerar` devuelven el resultado completo para que
 * la pantalla los muestre en el momento y los descarte al cerrar el modal.
 */
interface AccesoState {
  accesos: AccesoTemporal[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  vencimientos: AccesoVencimientos | null;
  vencimientosStatus: "idle" | "loading" | "ready" | "error";

  load: () => Promise<void>;
  loadVencimientos: () => Promise<void>;
  crear: (input: CreateAccesoInput) => Promise<AccesoCreadoResult>;
  actualizar: (id: string, input: UpdateAccesoInput) => Promise<void>;
  regenerar: (id: string, input?: RegenerarAccesoInput) => Promise<RegenerarAccesoResult>;
  revocar: (id: string) => Promise<void>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

export const useAccesoStore = create<AccesoState>((set, get) => ({
  accesos: [],
  status: "idle",
  error: null,

  vencimientos: null,
  vencimientosStatus: "idle",

  load: async () => {
    set({ status: get().status === "ready" ? "ready" : "loading", error: null });
    try {
      const accesos = await api.listAccesos();
      set({ accesos, status: "ready" });
    } catch (error) {
      set({ status: "error", error: messageOf(error) });
    }
  },

  loadVencimientos: async () => {
    if (get().vencimientosStatus === "loading") return;
    set({ vencimientosStatus: "loading" });
    try {
      const vencimientos = await api.getVencimientosAcceso();
      set({ vencimientos, vencimientosStatus: "ready" });
    } catch {
      set({ vencimientosStatus: "error" });
    }
  },

  crear: async (input) => {
    const resultado = await api.createAcceso(input);
    // Se releen todos en vez de insertar a mano: `listAccesos` ya filtra
    // "sólo vivos" y ordena, así que confiar en el servidor evita que este
    // store invente un orden o un campo que la respuesta de creación no trae
    // (`ultimoAccesoEn`/`fallosConsecutivos`, que sí vienen en la lista).
    await get().load();
    return resultado;
  },

  actualizar: async (id, input) => {
    const actualizado = await api.updateAcceso(id, input);
    set({ accesos: get().accesos.map((a) => (a.id === id ? actualizado : a)) });
  },

  regenerar: async (id, input) => {
    const resultado = await api.regenerarAcceso(id, input);
    // Regenerar también limpia `fallosConsecutivos` del lado del servidor
    // (ver el comentario en `mockClient.ts`) — se relee la fila para reflejar
    // ese reseteo en vez de asumirlo aquí.
    await get().load();
    return resultado;
  },

  revocar: async (id) => {
    await api.deleteAcceso(id);
    set({ accesos: get().accesos.filter((a) => a.id !== id) });
  },
}));
