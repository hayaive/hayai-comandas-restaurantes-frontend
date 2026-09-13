import { useMemo } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/api";
import type { CreateReservacionInput, Reservacion } from "@/api";
import { useFloorPlanStore } from "./useFloorPlanStore";
import { useComandaStore } from "./useComandaStore";

interface ReservationState {
  reservaciones: Reservacion[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  load: () => Promise<void>;
  create: (input: CreateReservacionInput) => Promise<Reservacion>;
  confirm: (id: string) => Promise<void>;
  cancel: (id: string, motivo: string) => Promise<void>;
  /** Staff check-in flow: looks up a reservation by its short or public code and seats it. */
  checkInByCode: (codigo: string) => Promise<Reservacion>;
  /** Self-seat flow: the guest assigns themselves a table from the public link. */
  assignTable: (codigoPublico: string, mesaId: string, mesaEtiqueta: string) => Promise<Reservacion>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

export const useReservationStore = create<ReservationState>((set, get) => ({
  reservaciones: [],
  status: "idle",
  error: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const reservaciones = await api.listReservaciones();
      set({ reservaciones, status: "ready" });
    } catch (error) {
      set({ status: "error", error: messageOf(error) });
    }
  },

  create: async (input) => {
    const reservacion = await api.createReservacion(input);
    set({ reservaciones: [...get().reservaciones, reservacion] });
    if (reservacion.mesaId) {
      useFloorPlanStore.getState().setStatus(reservacion.mesaId, "reserved", reservacion.clienteNombre);
    }
    return reservacion;
  },

  confirm: async (id) => {
    const updated = await api.confirmarReservacion(id);
    set({ reservaciones: get().reservaciones.map((r) => (r.id === id ? updated : r)) });
  },

  cancel: async (id, motivo) => {
    const target = get().reservaciones.find((r) => r.id === id);
    const updated = await api.cancelarReservacion(id, motivo);
    set({ reservaciones: get().reservaciones.map((r) => (r.id === id ? updated : r)) });
    if (target?.mesaId) {
      const table = useFloorPlanStore
        .getState()
        .templates.flatMap((tpl) => tpl.tables)
        .find((t) => t.id === target.mesaId);
      if (table?.status === "reserved") {
        useFloorPlanStore.getState().setStatus(target.mesaId, "free");
      }
    }
  },

  checkInByCode: async (codigo) => {
    const reservacion = await api.buscarReservacionPorCodigo(codigo);
    if (!reservacion) throw new ApiError("No se encontró una reserva con ese código", 404);
    if (reservacion.estado === "sentada") {
      throw new ApiError("Esta reserva ya fue registrada como sentada", 409);
    }
    if (reservacion.estado === "cancelada" || reservacion.estado === "no_show") {
      throw new ApiError("Esta reserva ya no está activa", 409);
    }
    const mesaId = reservacion.mesaId;
    if (!mesaId) {
      throw new ApiError("Esta reserva todavía no tiene mesa asignada; pide al cliente que elija una desde su enlace", 422);
    }
    const { reservacion: sentada, comanda } = await api.sentarReservacion(reservacion.id);
    set({ reservaciones: get().reservaciones.map((r) => (r.id === sentada.id ? sentada : r)) });
    useFloorPlanStore.getState().setStatus(mesaId, "occupied", sentada.clienteNombre);
    useComandaStore.getState().registerComanda(comanda);
    return sentada;
  },

  assignTable: async (codigoPublico, mesaId, mesaEtiqueta) => {
    const updated = await api.asignarMesaReservacion(codigoPublico, mesaId, mesaEtiqueta);
    set({ reservaciones: get().reservaciones.map((r) => (r.id === updated.id ? updated : r)) });
    useFloorPlanStore.getState().setStatus(mesaId, "reserved", updated.clienteNombre);
    return updated;
  },
}));

export function useTodaysReservations(): Reservacion[] {
  // OJO: el selector de un store de Zustand debe devolver una referencia
  // estable cuando el dato no cambió. Antes este selector hacía
  // `filter().sort()` inline, devolviendo un arreglo NUEVO en cada render;
  // con `useSyncExternalStore` (lo que usa Zustand v5) eso dispara un loop
  // infinito de renders (React error #185). Por eso se selecciona el
  // arreglo crudo (referencia estable entre renders si no cambió) y el
  // filtrado/orden se memoiza aparte.
  const reservaciones = useReservationStore((state) => state.reservaciones);
  return useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return reservaciones
      .filter((r) => {
        const start = new Date(r.iniciaEn);
        return start >= startOfDay && start <= endOfDay;
      })
      .sort((a, b) => a.iniciaEn.localeCompare(b.iniciaEn));
  }, [reservaciones]);
}
