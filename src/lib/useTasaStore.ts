import { useEffect } from "react";
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
  /**
   * Relectura de fondo, la que mantiene la tasa al día sin que nadie toque el
   * botón. Ver `useTasaBootstrap`.
   */
  refresh: () => Promise<void>;
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

  refresh: async () => {
    try {
      const vigente = await api.getTasaVigente();
      set({ vigente, status: "ready" });
      // Red de seguridad, no el camino normal: quien habla con dolarapi.com es
      // el cron de 6h del backend (`TasaSchedulerService`). Si ese ciclo no
      // pudo —la API externa caída justo en su turno—, la vigente se queda con
      // fecha de ayer y sólo el botón la destrabaría; eso es exactamente lo
      // que no debe pasar. Se mide contra USD porque es la del BCV y
      // `actualizarTasa` trae ambas divisas de una; en un día normal esta rama
      // no corre nunca y el refresco es una sola lectura.
      if (vigente.usd?.fecha !== vigente.fecha) {
        set({ vigente: await api.actualizarTasa() });
      }
    } catch {
      // Silencio deliberado: un refresco de fondo que falla no debe pintar un
      // error ni tapar el último valor bueno. Se reintenta al siguiente ciclo.
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

/**
 * Cada cuánto se relee la tasa. Misma cifra que el chequeo de versión del PWA
 * y por la misma razón: el BCV publica ~una vez por día hábil, así que 20 min
 * es de sobra para que nadie cobre con una tasa vieja, y son un puñado de
 * lecturas por turno en vez de charla por minuto.
 */
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

/**
 * Mantiene la tasa al día sola. Se monta una vez, en `TasaBar` (que vive en
 * `AppShell`, así que está activo en toda pantalla de staff).
 *
 * El botón de sincronizar nunca actualizó el BCV: sólo refrescaba ESTA
 * pantalla. El backend ya trae la tasa por su cuenta (cron cada 6h + fetch al
 * arrancar si no hay tasa de hoy), pero el cliente la pedía una sola vez, al
 * abrir la app — y estos aparatos se quedan abiertos el turno entero, así que
 * el valor en pantalla envejecía hasta que alguien tocaba el botón.
 *
 * `visibilitychange` importa tanto como el intervalo: un celular bloqueado o
 * en segundo plano no corre timers, y al desbloquearlo tiene que mostrar la
 * tasa buena de inmediato, no esperar lo que quede del ciclo.
 */
export function useTasaBootstrap(): void {
  const status = useTasaStore((state) => state.status);
  const load = useTasaStore((state) => state.load);
  const refresh = useTasaStore((state) => state.refresh);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);
}
