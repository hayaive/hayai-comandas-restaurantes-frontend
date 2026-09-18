import { useEffect } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/api";
import type {
  Cobro,
  CobrarMesaInput,
  Comanda,
  ComandaEnCola,
  CreateComandaInput,
  CuentaDeMesa,
  CuentaMesa,
} from "@/api";
import { useFloorPlanStore } from "./useFloorPlanStore";

/**
 * Comandas, cola de despacho y cobro.
 *
 * El modelo cambió de raíz: una comanda dejó de ser "la cuenta de la mesa" y
 * pasó a ser UN pedido. Las tres consecuencias que se notan en todo este
 * archivo, y la razón de que ya no exista nada parecido a
 * `useComandaForTable(mesaId)`:
 *
 * 1. **Una mesa tiene N comandas vivas.** Su cuenta es la suma de todas y la
 *    resuelve el servidor (`v_cuenta_mesa`), no una fila de comanda. Por eso
 *    aquí no se guarda una lista global de comandas: se guardan las DOS
 *    proyecciones que el backend expone —la cola de despacho y las cuentas por
 *    cobrar— y la ficha de una mesa se pide aparte.
 * 2. **El estado es derivado.** Nunca se escribe `estado`: se escribe el hecho
 *    (despachar, anular, cobrar) y se relee.
 * 3. **Se cobra la MESA, no la comanda.** Un cobro emite un `Cobro` que cubre
 *    varias comandas; lo que siga en cocina no entra y arranca la cuenta
 *    siguiente de esa mesa.
 *
 * La ocupación de una mesa tampoco se decide aquí: la calcula el backend
 * (`v_mesa_estado`). Cada acción que la cambia refresca el plano para
 * reconciliar en vez de inventar el estado del lado del cliente.
 */

/**
 * El backend rechaza el cobro mientras el restaurante no tenga registrada la
 * tasa del día: cobrar congela `tasaValor`/`totalBs` en el `Cobro`, así que sin
 * tasa no hay factura posible. No es un fallo técnico sino un paso operativo
 * que falta, y por eso se distingue del resto de errores: la UI lo resuelve
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

type Status = "idle" | "loading" | "ready" | "error";

interface ComandaState {
  /** `GET /despacho/cola` — global, FIFO estricto. La pantalla de cocina. */
  cola: ComandaEnCola[];
  colaStatus: Status;
  colaError: string | null;

  /** `GET /cuentas-por-cobrar` — mesas con saldo pendiente. */
  cuentas: CuentaMesa[];
  cuentasStatus: Status;
  cuentasError: string | null;

  /** `GET /mesas/:id/cuenta`, cacheado por mesa para la ficha de la mesa. */
  cuentaPorMesa: Record<string, CuentaDeMesa>;
  cuentaMesaStatus: Record<string, Status>;

  /** Facturas del día operativo — alimentan el histórico de Ventas. */
  cobrosDelDia: Cobro[];
  /**
   * `false` cuando el backend no sabe listar las facturas de un día y lo único
   * que se ve son las emitidas en esta sesión. Ventas lo dice explícitamente
   * en vez de hacer pasar una lista incompleta por el histórico del día.
   */
  historicoCompleto: boolean;

  loadCola: () => Promise<void>;
  /** Saca la comanda de la cola. NO la borra: queda cobrable en la mesa. */
  despachar: (comandaId: string) => Promise<void>;
  /** Anula UNA línea. Sólo mientras la comanda siga `pendiente`. */
  anularItem: (comandaId: string, itemId: string, motivo: string) => Promise<void>;
  anularComanda: (comandaId: string, motivo: string) => Promise<void>;
  /** Crea el pedido con sus ítems de una vez: nace ya encolado. */
  crearComanda: (input: CreateComandaInput) => Promise<Comanda>;

  loadCuentas: () => Promise<void>;
  loadCuentaDeMesa: (mesaId: string) => Promise<void>;
  /**
   * Cobra la mesa y devuelve la factura. Lanza `TasaRequeridaError` si falta
   * la tasa del día, para que la UI pueda pedirla y reintentar en un gesto.
   */
  cobrarMesa: (mesaId: string, input: CobrarMesaInput) => Promise<Cobro>;

  loadCobrosDelDia: (fecha: string) => Promise<void>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

export const useComandaStore = create<ComandaState>((set, get) => ({
  cola: [],
  colaStatus: "idle",
  colaError: null,

  cuentas: [],
  cuentasStatus: "idle",
  cuentasError: null,

  cuentaPorMesa: {},
  cuentaMesaStatus: {},

  cobrosDelDia: [],
  historicoCompleto: true,

  loadCola: async () => {
    // `loading` sólo marca el primer arranque: el polling no debe vaciar la
    // pantalla ni poner todo en "cargando" cada pocos segundos.
    set({ colaStatus: get().colaStatus === "ready" ? "ready" : "loading", colaError: null });
    try {
      set({ cola: await api.getColaDespacho(), colaStatus: "ready" });
    } catch (error) {
      set({ colaStatus: "error", colaError: messageOf(error) });
    }
  },

  despachar: async (comandaId) => {
    // Optimista: la comanda sale de la cola al instante (la cocina pulsa y
    // sigue). El 409 de la doble pulsación se reconcilia con el refetch.
    const previa = get().cola;
    set({ cola: previa.filter((c) => c.comandaId !== comandaId) });
    try {
      await api.despacharComanda(comandaId);
    } catch (error) {
      set({ cola: previa, colaError: messageOf(error) });
      throw error;
    }
    // Ya es cobrable: la ficha de su mesa y las cuentas por cobrar cambiaron.
    await get().loadCuentas();
    void useFloorPlanStore.getState().refreshPlano();
  },

  anularItem: async (comandaId, itemId, motivo) => {
    await api.removeComandaItem(comandaId, itemId, motivo);
    // El total lo recalcula el servidor: se relee en vez de restarlo aquí.
    await get().loadCola();
  },

  anularComanda: async (comandaId, motivo) => {
    await api.anularComanda(comandaId, motivo);
    await Promise.all([get().loadCola(), get().loadCuentas()]);
    void useFloorPlanStore.getState().refreshPlano();
  },

  crearComanda: async (input) => {
    const comanda = await api.createComanda(input);
    // Nace ya en la cola y la mesa pasa a ocupada server-side.
    await Promise.all([get().loadCola(), get().loadCuentas()]);
    if (comanda.mesaId) {
      void get().loadCuentaDeMesa(comanda.mesaId);
    }
    void useFloorPlanStore.getState().refreshPlano();
    return comanda;
  },

  loadCuentas: async () => {
    set({
      cuentasStatus: get().cuentasStatus === "ready" ? "ready" : "loading",
      cuentasError: null,
    });
    try {
      set({ cuentas: await api.getCuentasPorCobrar(), cuentasStatus: "ready" });
    } catch (error) {
      set({ cuentasStatus: "error", cuentasError: messageOf(error) });
    }
  },

  loadCuentaDeMesa: async (mesaId) => {
    set({ cuentaMesaStatus: { ...get().cuentaMesaStatus, [mesaId]: "loading" } });
    try {
      const cuenta = await api.getCuentaDeMesa(mesaId);
      set({
        cuentaPorMesa: { ...get().cuentaPorMesa, [mesaId]: cuenta },
        cuentaMesaStatus: { ...get().cuentaMesaStatus, [mesaId]: "ready" },
      });
    } catch {
      set({ cuentaMesaStatus: { ...get().cuentaMesaStatus, [mesaId]: "error" } });
    }
  },

  cobrarMesa: async (mesaId, input) => {
    let cobro: Cobro;
    try {
      cobro = await api.cobrarMesa(mesaId, input);
    } catch (error) {
      if (esFaltaDeTasa(error)) throw new TasaRequeridaError(messageOf(error));
      throw error;
    }

    set({
      cobrosDelDia: [cobro, ...get().cobrosDelDia.filter((c) => c.id !== cobro.id)],
    });
    // Cobrar NO libera la mesa por decreto: si quedaban comandas en cocina,
    // esa cuenta sigue viva. Quien decide es el servidor, así que se relee
    // todo en vez de marcar la mesa libre de forma optimista.
    await Promise.all([get().loadCuentas(), get().loadCuentaDeMesa(mesaId), get().loadCola()]);
    void useFloorPlanStore.getState().refreshPlano();
    return cobro;
  },

  loadCobrosDelDia: async (fecha) => {
    const delBackend = await api.listCobrosDelDia(fecha);
    if (delBackend === null) {
      // Sin endpoint de histórico: se conserva lo cobrado en esta sesión.
      set({ historicoCompleto: false });
      return;
    }
    set({ cobrosDelDia: delBackend, historicoCompleto: true });
  },
}));

/**
 * Carga `cola` y `cuentas` una sola vez por sesión y las refresca con un
 * poll periódico — se monta en `AppShell` (mismo patrón que
 * `useFloorPlanBootstrap`), porque los badges de "Despacho" y "Por cobrar"
 * viven en la navegación, presente en TODA pantalla de staff, no sólo en
 * Comandas o Cuentas. Sin esto el número sólo se actualizaría cuando el
 * usuario ya está parado en esa pantalla, que es justo cuando el badge deja
 * de hacer falta.
 *
 * Intervalo: 25s, dentro del rango pedido (20-30s). La pantalla de Despacho
 * pollea cada 6s porque ahí la cocina está mirando la cola activamente y
 * cada segundo de más es un pedido que tarda en aparecer; un badge de conteo
 * no toma decisiones por sí solo, sólo dice "hay algo pendiente, entra a
 * ver" — no necesita esa frescura, y pollear cada 6s desde CUALQUIER
 * pantalla de la app sería tráfico de red que nadie pidió.
 */
export function useComandaBootstrap(): void {
  const colaStatus = useComandaStore((state) => state.colaStatus);
  const cuentasStatus = useComandaStore((state) => state.cuentasStatus);
  const loadCola = useComandaStore((state) => state.loadCola);
  const loadCuentas = useComandaStore((state) => state.loadCuentas);

  useEffect(() => {
    if (colaStatus === "idle") void loadCola();
  }, [colaStatus, loadCola]);

  useEffect(() => {
    if (cuentasStatus === "idle") void loadCuentas();
  }, [cuentasStatus, loadCuentas]);

  useEffect(() => {
    const POLL_INTERVAL_MS = 25_000;

    // A diferencia de `PwaUpdateBanner` (chequeo cada 20 MINUTOS, así que da
    // igual si un tick cae con la pestaña oculta), acá el intervalo es corto
    // y toca dos endpoints, así que sí vale la pena saltarse el tick cuando
    // nadie está mirando la pantalla — una tablet de host bloqueada no
    // necesita refrescar un badge cada 25s. El `visibilitychange` sigue el
    // mismo patrón: al volver a primer plano se refresca de inmediato en vez
    // de esperar el resto del intervalo, que podría dejar el número minutos
    // desactualizado.
    function poll() {
      if (document.visibilityState === "hidden") return;
      const state = useComandaStore.getState();
      if (state.colaStatus !== "loading") void loadCola();
      if (state.cuentasStatus !== "loading") void loadCuentas();
    }

    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") poll();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadCola, loadCuentas]);
}
