import { useEffect } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/api";
import type {
  Mesa,
  MesaEstado,
  PlantillaDetalle,
  PlantillaMesa,
  Salon,
  UpdatePlantillaMesaInput,
} from "@/api";
import { CANVAS_HEIGHT, CANVAS_WIDTH, clamp } from "@/components/floor-plan/geometry";
import type { FloorPlanTemplate, RestaurantTable, TableShape, TableStatus } from "./types";

/**
 * El editor de plano, conectado al backend real.
 *
 * Antes este store era enteramente local: arrancaba de `seedTemplates` y los
 * ids de mesa eran sintéticos (`t-1000`), así que TODO flujo que mandara un
 * `mesaId` salido de aquí fallaba contra el backend ("mesaId must be a UUID" /
 * "Mesa no encontrada"). Ahora las mesas son `mesa.id` reales y el layout vive
 * en `plantilla_mesa`.
 *
 * Tres ideas que hay que tener claras para leer este archivo:
 *
 * 1. **Identidad vs. sitio en el plano.** `etiqueta` (el número de la mesa)
 *    pertenece a `Mesa` y se cambia con `PATCH /mesas/:id`; posición, forma y
 *    sillas pertenecen a `PlantillaMesa` y se cambian con
 *    `PATCH /plantillas/:id/mesas/:mesaId`. Renombrar una mesa la renombra en
 *    todas las plantillas; moverla sólo la mueve en la que se está editando.
 * 2. **El estado (libre/ocupada/reservada) es derivado.** Lo calcula el
 *    servidor en la vista `v_mesa_estado` (`GET /plano`). Aquí sólo se pinta y,
 *    como mucho, se adelanta de forma optimista (`setStatus`) hasta el próximo
 *    `refreshPlano()`. El cliente nunca lo inventa.
 * 3. **Activa ≠ en edición.** `activeTemplateId` es la distribución que el
 *    restaurante está usando ahora mismo (`plantilla.activa`, garantizada única
 *    por salón en la base); `editingTemplateId` es la que se ve en el editor.
 *    Cambiar de pestaña NO activa nada: activar mueve reservas y es una
 *    decisión explícita (`activateTemplate`).
 *
 * El canvas trabaja en CENTROS de mesa y el backend guarda la ESQUINA SUPERIOR
 * IZQUIERDA. La conversión está en `toRestaurantTable` / `toCornerPosition` y
 * no debe filtrarse a ningún componente.
 */

type FloorPlanStatus = "idle" | "loading" | "ready" | "error";

/** Clave de `rawByKey`: la PK compuesta de `plantilla_mesa`. */
function rowKey(plantillaId: string, mesaId: string): string {
  return `${plantillaId}:${mesaId}`;
}

const EMPTY_TEMPLATE: FloorPlanTemplate = { id: "", name: "Sin plantilla", tables: [] };

const DEFAULT_SIZE_BY_SHAPE: Record<TableShape, number> = { circle: 90, square: 78 };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toUiShape(forma: PlantillaMesa["forma"]): TableShape {
  return forma === "redonda" ? "circle" : "square";
}

function toUiStatus(estado: MesaEstado["estado"]): TableStatus {
  switch (estado) {
    case "ocupada":
      return "occupied";
    case "reservada":
      return "reserved";
    // El editor sólo conoce tres estados; una mesa bloqueada se pinta como
    // no disponible. Falta un cuarto estado propio en el design system.
    case "bloqueada":
      return "occupied";
    default:
      return "free";
  }
}

/**
 * Quién está (o va a estar) en la mesa.
 *
 * `v_mesa_estado` distingue dos reservaciones y el orden importa: la SENTADA
 * es la gente que ya está ahí, y manda sobre `reservacionCliente`, que es la
 * PRÓXIMA en llegar. Leer sólo la segunda —como se hacía cuando la vista traía
 * una sola— rotularía una mesa ocupada con el nombre de quien todavía no llegó.
 */
function occupantOf(estado: MesaEstado | undefined): string | undefined {
  if (!estado) return undefined;
  if (estado.estado === "bloqueada") return "Fuera de servicio";
  return estado.sentadaCliente ?? estado.reservacionCliente ?? undefined;
}

/** `plantilla_mesa` (+ identidad + estado) → la mesa que dibuja el canvas. */
function toRestaurantTable(row: PlantillaMesa, estado: MesaEstado | undefined): RestaurantTable {
  const ancho = Number(row.ancho) || DEFAULT_SIZE_BY_SHAPE.square;
  const alto = Number(row.alto) || ancho;
  const size = ancho;
  const half = size / 2;
  return {
    id: row.mesaId,
    label: row.mesa?.etiqueta ?? estado?.etiqueta ?? "?",
    shape: toUiShape(row.forma),
    // El lienzo del editor es fijo (1200x700) y el del backend puede ser mayor
    // (el seed usa 1200x800): se acota para que ninguna mesa quede fuera de la
    // vista y sea inalcanzable. La posición guardada sólo se reescribe si el
    // usuario mueve esa mesa.
    x: clamp(Number(row.posX) + ancho / 2, half, CANVAS_WIDTH - half),
    y: clamp(Number(row.posY) + alto / 2, alto / 2, CANVAS_HEIGHT - alto / 2),
    size,
    seats: row.capacidad,
    status: toUiStatus(estado?.estado ?? "libre"),
    occupantName: occupantOf(estado),
  };
}

/** Centro del canvas → esquina superior izquierda del backend. */
function toCornerPosition(table: RestaurantTable, row: PlantillaMesa): { posX: number; posY: number } {
  const ancho = Number(row.ancho) || table.size;
  const alto = Number(row.alto) || ancho;
  return { posX: round2(table.x - ancho / 2), posY: round2(table.y - alto / 2) };
}

function indexPlano(rows: MesaEstado[]): {
  byRow: Map<string, MesaEstado>;
  byMesa: Map<string, MesaEstado>;
} {
  const byRow = new Map<string, MesaEstado>();
  const byMesa = new Map<string, MesaEstado>();
  for (const row of rows) {
    byRow.set(rowKey(row.plantillaId, row.mesaId), row);
    // Una mesa puede aparecer en varias plantillas; para el fallback vale
    // cualquiera de sus filas, el estado operativo es el mismo.
    if (!byMesa.has(row.mesaId) || row.plantillaActiva) byMesa.set(row.mesaId, row);
  }
  return { byRow, byMesa };
}

function buildTemplate(
  detalle: PlantillaDetalle,
  plano: ReturnType<typeof indexPlano>,
): FloorPlanTemplate {
  return {
    id: detalle.id,
    name: detalle.nombre,
    tables: detalle.mesas.map((row) =>
      toRestaurantTable(
        row,
        plano.byRow.get(rowKey(detalle.id, row.mesaId)) ?? plano.byMesa.get(row.mesaId),
      ),
    ),
  };
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

/**
 * El canvas emite `onMove` en CADA pointermove (y en cada flecha del teclado),
 * y el inspector emite `onRename` en cada tecla. Persistir eso tal cual sería
 * un request por píxel, así que la escritura se agrupa: el estado local cambia
 * al instante y el PATCH sale una sola vez, cuando el gesto se detiene.
 */
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleWrite(key: string, delayMs: number, run: () => void): void {
  const pending = writeTimers.get(key);
  if (pending) clearTimeout(pending);
  writeTimers.set(
    key,
    setTimeout(() => {
      writeTimers.delete(key);
      run();
    }, delayMs),
  );
}

const MOVE_DEBOUNCE_MS = 400;
const TEXT_DEBOUNCE_MS = 600;
const STEPPER_DEBOUNCE_MS = 350;

/** `"M-16"` → `{ prefix: "M-", n: 16 }`. `null` si no termina en número. */
function splitLabel(label: string): { prefix: string; n: number } | null {
  const match = /^(.*?)(\d+)$/.exec(label.trim());
  if (!match) return null;
  const n = Number(match[2]);
  return Number.isSafeInteger(n) ? { prefix: match[1], n } : null;
}

/** El prefijo más usado del conjunto; empata a favor del primero visto. */
function dominantPrefix(parts: { prefix: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const { prefix } of parts) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [prefix, count] of counts) {
    if (count > bestCount) {
      best = prefix;
      bestCount = count;
    }
  }
  return best;
}

const DEFAULT_LABEL_PREFIX = "M";

/**
 * Por dónde sigue la numeración del plano en edición.
 *
 * Se toma el MAYOR número dibujado en ESA plantilla y se le suma uno: si la
 * última es la M-16, la siguiente es la M-17. Antes se usaba
 * `tables.length + 1`, que no es lo mismo en cuanto hay un hueco — borrar la
 * M-15 y la M-16 dejaba 14 mesas y el contador volvía a proponer "M-15", que
 * el backend rechaza con 409 porque quitar una mesa del plano NO borra su
 * identidad ni libera su etiqueta (eso es `deleteTablePermanently`).
 *
 * El número es por plantilla, así que una distribución nueva arranca vacía y
 * vuelve sola a 1. El prefijo, en cambio, se copia: primero del propio plano
 * ("M-", "B-", "T-"…) y si está vacío del resto del restaurante, para que esa
 * "mesa 1" de la plantilla nueva sea la M-1 que ya existe y no una identidad
 * paralela con otro nombre.
 */
function nextTableNumber(
  templates: FloorPlanTemplate[],
  plantillaId: string,
): { prefix: string; from: number } {
  const own = (templates.find((tpl) => tpl.id === plantillaId)?.tables ?? [])
    .map((t) => splitLabel(t.label))
    .filter((part): part is { prefix: string; n: number } => part !== null);
  const everywhere = templates
    .flatMap((tpl) => tpl.tables)
    .map((t) => splitLabel(t.label))
    .filter((part): part is { prefix: string; n: number } => part !== null);

  const prefix = dominantPrefix(own) ?? dominantPrefix(everywhere) ?? DEFAULT_LABEL_PREFIX;
  const last = own.reduce((max, part) => (part.prefix === prefix ? Math.max(max, part.n) : max), 0);
  return { prefix, from: last + 1 };
}

/**
 * La identidad que ya lleva esa etiqueta.
 *
 * Manda el registro de mesas (`GET /mesas`), no lo dibujado: una mesa quitada
 * del plano sigue viva y con su etiqueta tomada, pero no aparece en ninguna
 * plantilla. Buscarla sólo en `templates` —como se hacía— la dejaba invisible
 * y el número saltaba por encima de ella (plano vacío tras quitar M-1, M-2 y
 * M-3 → la siguiente salía M-4). `templates` queda de respaldo por si el
 * registro no se pudo cargar.
 */
function findMesaIdByLabel(
  mesas: Mesa[],
  templates: FloorPlanTemplate[],
  label: string,
): string | undefined {
  const needle = label.trim().toLowerCase();
  const mesa = mesas.find((m) => m.etiqueta.trim().toLowerCase() === needle);
  if (mesa) return mesa.id;
  for (const tpl of templates) {
    const match = tpl.tables.find((t) => t.label.trim().toLowerCase() === needle);
    if (match) return match.id;
  }
  return undefined;
}

/**
 * Cuántas etiquetas se prueban antes de rendirse. Una etiqueta puede estar
 * tomada por una mesa que no se dibuja en NINGUNA plantilla (se quitó del
 * plano pero su identidad sigue viva) y el cliente no tiene endpoint para
 * enumerarlas: eso sólo se sabe por el 409 del backend.
 */
const MAX_LABEL_ATTEMPTS = 25;

interface FloorPlanState {
  salones: Salon[];
  salonId: string | null;

  templates: FloorPlanTemplate[];
  /** Distribución que el restaurante usa ahora mismo (`plantilla.activa`). */
  activeTemplateId: string;
  /** Distribución abierta en el editor. Arranca en la activa. */
  editingTemplateId: string;
  /** `plantilla_mesa` cruda, para no perder campos que la UI no representa. */
  rawByKey: Record<string, PlantillaMesa>;
  /**
   * TODAS las identidades vivas del salón, dibujadas o no. No se pinta: sirve
   * para numerar mesas nuevas sin chocar con una etiqueta que sigue ocupada.
   */
  mesas: Mesa[];

  selectedTableId: string | null;
  /** Sólo controla el espaciado del patrón de puntos del canvas — el ajuste a grilla se quitó. */
  gridSize: number;

  status: FloorPlanStatus;
  error: string | null;
  /** Aviso no bloqueante (p. ej. reservaciones huérfanas tras activar). */
  notice: string | null;

  load: () => Promise<void>;
  /** Reconcilia el estado derivado de las mesas con `GET /plano`. */
  refreshPlano: () => Promise<void>;
  clearError: () => void;
  clearNotice: () => void;

  // Plantillas
  selectTemplate: (templateId: string) => void;
  activateTemplate: (templateId: string) => Promise<void>;
  addTemplate: (name: string) => Promise<void>;
  renameTemplate: (templateId: string, name: string) => Promise<void>;
  removeTemplate: (templateId: string) => Promise<void>;

  // Mesas
  addTable: (shape: TableShape) => Promise<void>;
  removeTable: (tableId: string) => Promise<void>;
  /**
   * "Esta mesa ya no existe": borrado lógico de la IDENTIDAD (CONTRACT.md
   * §3.6). Distinto de `removeTable`, que sólo la saca del plano en edición.
   * Esta la quita de TODAS las distribuciones donde apareciera y libera su
   * etiqueta para que una mesa nueva pueda reusarla.
   */
  deleteTablePermanently: (tableId: string) => Promise<void>;
  moveTable: (tableId: string, x: number, y: number) => void;
  renameTable: (tableId: string, label: string) => void;
  setSeats: (tableId: string, seats: number) => void;
  setShape: (tableId: string, shape: TableShape) => void;
  /** Sólo optimista: la verdad la trae `refreshPlano()`. */
  setStatus: (tableId: string, status: TableStatus, occupantName?: string) => void;

  // Selección y UX del canvas
  selectTable: (tableId: string | null) => void;
}

function mapEditingTables(
  state: FloorPlanState,
  updater: (tables: RestaurantTable[]) => RestaurantTable[],
): FloorPlanTemplate[] {
  return state.templates.map((tpl) =>
    tpl.id === state.editingTemplateId ? { ...tpl, tables: updater(tpl.tables) } : tpl,
  );
}

/** Aplica un cambio de identidad/estado a esa mesa en TODAS las plantillas. */
function mapTableEverywhere(
  templates: FloorPlanTemplate[],
  tableId: string,
  updater: (table: RestaurantTable) => RestaurantTable,
): FloorPlanTemplate[] {
  return templates.map((tpl) => ({
    ...tpl,
    tables: tpl.tables.map((t) => (t.id === tableId ? updater(t) : t)),
  }));
}

export const useFloorPlanStore = create<FloorPlanState>((set, get) => ({
  salones: [],
  salonId: null,
  templates: [],
  activeTemplateId: "",
  editingTemplateId: "",
  rawByKey: {},
  mesas: [],
  selectedTableId: null,
  gridSize: 20,
  status: "idle",
  error: null,
  notice: null,

  load: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const salones = await api.listSalones();
      if (salones.length === 0) {
        set({
          salones,
          salonId: null,
          templates: [],
          rawByKey: {},
          mesas: [],
          activeTemplateId: "",
          editingTemplateId: "",
          status: "ready",
        });
        return;
      }
      const salonId = salones[0].id;
      const plantillas = await api.listPlantillas(salonId);
      const [detalles, plano, mesas] = await Promise.all([
        Promise.all(plantillas.map((p) => api.getPlantilla(p.id))),
        api.getPlano(salonId),
        // El registro sólo alimenta la numeración: si falla, el plano tiene
        // que cargar igual. Sin él `addTable` cae al respaldo de siempre
        // (mirar lo dibujado), que es peor pero no rompe nada.
        api.listMesas(salonId).catch(() => [] as Mesa[]),
      ]);

      const indexed = indexPlano(plano);
      const templates = detalles.map((detalle) => buildTemplate(detalle, indexed));
      const rawByKey: Record<string, PlantillaMesa> = {};
      for (const detalle of detalles) {
        for (const row of detalle.mesas) rawByKey[rowKey(detalle.id, row.mesaId)] = row;
      }

      const activeTemplateId =
        plantillas.find((p) => p.activa)?.id ?? plantillas[0]?.id ?? "";
      const previousEditing = get().editingTemplateId;
      const editingTemplateId = templates.some((t) => t.id === previousEditing)
        ? previousEditing
        : activeTemplateId;

      set({
        salones,
        salonId,
        templates,
        rawByKey,
        mesas,
        activeTemplateId,
        editingTemplateId,
        selectedTableId: null,
        status: "ready",
        error: null,
      });
    } catch (error) {
      set({ status: "error", error: messageOf(error) });
    }
  },

  refreshPlano: async () => {
    const { salonId } = get();
    if (!salonId) return;
    try {
      const plano = await api.getPlano(salonId);
      const indexed = indexPlano(plano);
      set((state) => ({
        templates: state.templates.map((tpl) => ({
          ...tpl,
          tables: tpl.tables.map((table) => {
            const estado =
              indexed.byRow.get(rowKey(tpl.id, table.id)) ?? indexed.byMesa.get(table.id);
            if (!estado) return table;
            const status = toUiStatus(estado.estado);
            const occupantName = occupantOf(estado);
            if (table.status === status && table.occupantName === occupantName) return table;
            return { ...table, status, occupantName };
          }),
        })),
      }));
    } catch (error) {
      set({ error: messageOf(error) });
    }
  },

  clearError: () => set({ error: null }),
  clearNotice: () => set({ notice: null }),

  // --- Plantillas ---------------------------------------------------------

  selectTemplate: (templateId) =>
    set({ editingTemplateId: templateId, selectedTableId: null, notice: null }),

  activateTemplate: async (templateId) => {
    try {
      const { reservacionesHuerfanas } = await api.activarPlantilla(templateId);
      set({ activeTemplateId: templateId, editingTemplateId: templateId, error: null });
      const huerfanas = reservacionesHuerfanas.length;
      set({
        notice:
          huerfanas > 0
            ? `Distribución activada. ${huerfanas} ${
                huerfanas === 1 ? "reservación quedó" : "reservaciones quedaron"
              } sin mesa en este plano: hay que reasignarla${huerfanas === 1 ? "" : "s"}.`
            : "Distribución activada.",
      });
      await get().refreshPlano();
    } catch (error) {
      set({ error: messageOf(error) });
    }
  },

  addTemplate: async (name) => {
    const { salonId } = get();
    if (!salonId) return;
    const nombre = name.trim() || "Plantilla sin nombre";
    try {
      const plantilla = await api.createPlantilla(salonId, {
        nombre,
        anchoPlano: CANVAS_WIDTH,
        altoPlano: CANVAS_HEIGHT,
      });
      set((state) => ({
        templates: [...state.templates, { id: plantilla.id, name: plantilla.nombre, tables: [] }],
        editingTemplateId: plantilla.id,
        selectedTableId: null,
        error: null,
        notice:
          "Plantilla creada vacía. Sigue sin usarse hasta que la actives con «Usar esta distribución».",
      }));
    } catch (error) {
      set({ error: messageOf(error) });
    }
  },

  renameTemplate: async (templateId, name) => {
    const nombre = name.trim();
    if (!nombre) return;
    const previous = get().templates.find((t) => t.id === templateId)?.name;
    set((state) => ({
      templates: state.templates.map((tpl) =>
        tpl.id === templateId ? { ...tpl, name: nombre } : tpl,
      ),
    }));
    try {
      await api.updatePlantilla(templateId, { nombre });
    } catch (error) {
      set((state) => ({
        error: messageOf(error),
        templates: state.templates.map((tpl) =>
          tpl.id === templateId && previous ? { ...tpl, name: previous } : tpl,
        ),
      }));
    }
  },

  removeTemplate: async (templateId) => {
    const state = get();
    if (state.templates.length <= 1) return;
    if (templateId === state.activeTemplateId) {
      set({
        error:
          "No se puede eliminar la distribución activa: activa otra primero y vuelve a intentarlo.",
      });
      return;
    }
    const index = state.templates.findIndex((tpl) => tpl.id === templateId);
    const removed = state.templates[index];
    if (!removed) return;
    const remaining = state.templates.filter((tpl) => tpl.id !== templateId);
    const wasEditing = state.editingTemplateId === templateId;
    set({
      templates: remaining,
      editingTemplateId: wasEditing ? state.activeTemplateId : state.editingTemplateId,
      selectedTableId: wasEditing ? null : state.selectedTableId,
      error: null,
    });
    try {
      await api.deletePlantilla(templateId);
    } catch (error) {
      // Revert locally instead of a full `load()`: `load()` starts by setting
      // `error: null` itself, which — since nothing here awaits a render in
      // between — wiped this exact error out before React ever painted it,
      // so a rejected delete (e.g. a plantilla with reservaciones/comandas
      // history, which the backend refuses with 422) silently reappeared
      // with no visible explanation. Put it back where it was instead.
      set((current) => ({
        error: messageOf(error),
        templates: current.templates.some((tpl) => tpl.id === templateId)
          ? current.templates
          : [...current.templates.slice(0, index), removed, ...current.templates.slice(index)],
        editingTemplateId: wasEditing ? templateId : current.editingTemplateId,
      }));
    }
  },

  // --- Mesas --------------------------------------------------------------

  addTable: async (shape) => {
    const state = get();
    const plantillaId = state.editingTemplateId;
    if (!plantillaId) return;

    const tables = state.templates.find((tpl) => tpl.id === plantillaId)?.tables ?? [];

    const size = DEFAULT_SIZE_BY_SHAPE[shape];
    const half = size / 2;
    const x = clamp(140 + ((tables.length * 47) % 900), half, CANVAS_WIDTH - half);
    const y = clamp(140 + ((tables.length * 83) % 480), half, CANVAS_HEIGHT - half);
    const layout = {
      posX: round2(x - half),
      posY: round2(y - half),
      ancho: size,
      alto: size,
      forma: (shape === "circle" ? "redonda" : "cuadrada") as PlantillaMesa["forma"],
      capacidad: 4,
    };

    const { prefix, from } = nextTableNumber(state.templates, plantillaId);
    const inThisPlan = new Set(tables.map((t) => t.label.trim().toLowerCase()));

    for (let n = from; n < from + MAX_LABEL_ATTEMPTS; n += 1) {
      const etiqueta = `${prefix}${n}`;
      // Por construcción `from` va por encima del plano, pero una etiqueta
      // escrita a mano ("M-20" en un plano que llega a la 8) puede cruzarse.
      if (inThisPlan.has(etiqueta.toLowerCase())) continue;

      // La etiqueta es única en TODO el restaurante: si esa mesa ya existe
      // —dibujada en otra distribución o simplemente quitada de todos los
      // planos— esto la trae a ésta en vez de intentar clonar su número. Es lo
      // que deja que una plantilla nueva empiece en la 1 y que una mesa que se
      // quitó vuelva con su mismo número: es la misma mesa física.
      const mesaId = findMesaIdByLabel(state.mesas, state.templates, etiqueta);

      try {
        const row = await api.createPlantillaMesa(
          plantillaId,
          mesaId ? { mesaId, ...layout } : { etiqueta, ...layout },
        );
        set((current) => {
          // `PATCH …/mesas/:id` no trae la identidad; al reusar una mesa se
          // recupera de lo ya cargado para que el canvas no pinte "?".
          const mesa =
            row.mesa ?? Object.values(current.rawByKey).find((r) => r.mesaId === row.mesaId)?.mesa;
          const stored = mesa ? { ...row, mesa } : row;
          return {
            rawByKey: { ...current.rawByKey, [rowKey(plantillaId, stored.mesaId)]: stored },
            // Identidad recién nacida: entra al registro para que el siguiente
            // `addTable` de esta misma sesión ya la vea.
            mesas:
              mesa && !current.mesas.some((m) => m.id === mesa.id)
                ? [...current.mesas, mesa]
                : current.mesas,
            templates: current.templates.map((tpl) =>
              tpl.id === plantillaId
                ? { ...tpl, tables: [...tpl.tables, toRestaurantTable(stored, undefined)] }
                : tpl,
            ),
            selectedTableId: stored.mesaId,
            error: null,
          };
        });
        return;
      } catch (error) {
        // 409 al crear identidad = la etiqueta la tiene una mesa que no se
        // dibuja en ninguna plantilla. Es invisible desde aquí, así que la
        // única salida es correr el número y volver a probar.
        if (error instanceof ApiError && error.status === 409 && !mesaId) continue;
        set({ error: messageOf(error) });
        return;
      }
    }

    set({
      error: `No se pudo numerar la mesa nueva: de ${prefix}${from} en adelante todas las etiquetas están ocupadas. Renombra o elimina alguna mesa antes de agregar otra.`,
    });
  },

  removeTable: async (tableId) => {
    const state = get();
    const plantillaId = state.editingTemplateId;
    const key = rowKey(plantillaId, tableId);
    const row = state.rawByKey[key];
    const removed = state.templates
      .find((tpl) => tpl.id === plantillaId)
      ?.tables.find((t) => t.id === tableId);
    if (!row || !removed) return;

    set({
      templates: mapEditingTables(state, (tables) => tables.filter((t) => t.id !== tableId)),
      selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
      error: null,
    });
    try {
      // Saca la mesa del plano; la identidad sobrevive con su histórico.
      await api.deletePlantillaMesa(plantillaId, tableId);
      set((current) => {
        const nextRaw = { ...current.rawByKey };
        delete nextRaw[key];
        return { rawByKey: nextRaw };
      });
    } catch (error) {
      set((current) => ({
        error: messageOf(error),
        templates: current.templates.map((tpl) =>
          tpl.id === plantillaId ? { ...tpl, tables: [...tpl.tables, removed] } : tpl,
        ),
      }));
    }
  },

  deleteTablePermanently: async (tableId) => {
    const state = get();
    // La misma mesa puede estar dibujada en varias plantillas: hay que
    // recordar dónde estaba (y su fila cruda) para poder revertir si el
    // backend la rechaza (p. ej. mesa con comandas/reservas que ya no
    // debería poder pasar, pero por si acaso).
    const snapshot = state.templates
      .map((tpl) => ({ tplId: tpl.id, table: tpl.tables.find((t) => t.id === tableId) }))
      .filter((entry): entry is { tplId: string; table: RestaurantTable } => Boolean(entry.table));
    if (snapshot.length === 0) return;
    const rawSnapshot = Object.fromEntries(
      Object.entries(state.rawByKey).filter(([, row]) => row.mesaId === tableId),
    );
    const mesaSnapshot = state.mesas.find((m) => m.id === tableId);

    set((current) => ({
      templates: current.templates.map((tpl) => ({
        ...tpl,
        tables: tpl.tables.filter((t) => t.id !== tableId),
      })),
      rawByKey: Object.fromEntries(
        Object.entries(current.rawByKey).filter(([, row]) => row.mesaId !== tableId),
      ),
      // Éste sí libera la etiqueta (`eliminada_en` deja de ser null y el
      // índice parcial la suelta), así que sale del registro y su número
      // vuelve a estar disponible para una mesa nueva.
      mesas: current.mesas.filter((m) => m.id !== tableId),
      selectedTableId: current.selectedTableId === tableId ? null : current.selectedTableId,
      error: null,
    }));

    try {
      await api.deleteMesa(tableId);
    } catch (error) {
      set((current) => ({
        error: messageOf(error),
        templates: current.templates.map((tpl) => {
          const entry = snapshot.find((s) => s.tplId === tpl.id);
          if (!entry || tpl.tables.some((t) => t.id === tableId)) return tpl;
          return { ...tpl, tables: [...tpl.tables, entry.table] };
        }),
        rawByKey: { ...current.rawByKey, ...rawSnapshot },
        // La mesa sigue viva en el backend: su etiqueta nunca se liberó y
        // tiene que volver al registro o el numerador la daría por libre.
        mesas:
          mesaSnapshot && !current.mesas.some((m) => m.id === tableId)
            ? [...current.mesas, mesaSnapshot]
            : current.mesas,
      }));
    }
  },

  moveTable: (tableId, x, y) => {
    const plantillaId = get().editingTemplateId;
    set((state) => ({
      templates: mapEditingTables(state, (tables) =>
        tables.map((t) => (t.id === tableId ? { ...t, x, y } : t)),
      ),
    }));

    scheduleWrite(`move:${rowKey(plantillaId, tableId)}`, MOVE_DEBOUNCE_MS, () => {
      void (async () => {
        const state = get();
        const row = state.rawByKey[rowKey(plantillaId, tableId)];
        const table = state.templates
          .find((tpl) => tpl.id === plantillaId)
          ?.tables.find((t) => t.id === tableId);
        if (!row || !table) return;
        try {
          const updated = await api.updatePlantillaMesa(
            plantillaId,
            tableId,
            toCornerPosition(table, row),
          );
          set((current) => ({
            rawByKey: {
              ...current.rawByKey,
              [rowKey(plantillaId, tableId)]: { ...updated, mesa: row.mesa },
            },
          }));
        } catch (error) {
          set({ error: messageOf(error) });
        }
      })();
    });
  },

  renameTable: (tableId, label) => {
    const trimmed = label.trim();
    // La etiqueta vive en la identidad de la mesa: cambia en todas las plantillas.
    set((state) => ({
      templates: mapTableEverywhere(state.templates, tableId, (t) => ({ ...t, label })),
    }));
    if (!trimmed) return;

    scheduleWrite(`label:${tableId}`, TEXT_DEBOUNCE_MS, () => {
      void (async () => {
        try {
          const mesa = await api.updateMesa(tableId, { etiqueta: trimmed });
          set((state) => ({
            templates: mapTableEverywhere(state.templates, tableId, (t) => ({
              ...t,
              label: mesa.etiqueta,
            })),
            rawByKey: Object.fromEntries(
              Object.entries(state.rawByKey).map(([key, row]) =>
                row.mesaId === tableId ? [key, { ...row, mesa }] : [key, row],
              ),
            ),
            // El registro guarda etiquetas: si no se actualiza aquí, la vieja
            // seguiría "ocupada" y la nueva libre para el numerador.
            mesas: state.mesas.map((m) => (m.id === tableId ? mesa : m)),
            error: null,
          }));
        } catch (error) {
          // Etiqueta duplicada (409) o inválida: se vuelve a la del servidor.
          const previous = Object.values(get().rawByKey).find((row) => row.mesaId === tableId)?.mesa
            ?.etiqueta;
          set((state) => ({
            error: messageOf(error),
            templates: previous
              ? mapTableEverywhere(state.templates, tableId, (t) => ({ ...t, label: previous }))
              : state.templates,
          }));
        }
      })();
    });
  },

  setSeats: (tableId, seats) => {
    // El backend acepta 1-50; el inspector tope en 20 por diseño.
    const capacidad = clamp(Math.round(seats), 1, 50);
    const plantillaId = get().editingTemplateId;
    set((state) => ({
      templates: mapEditingTables(state, (tables) =>
        tables.map((t) => (t.id === tableId ? { ...t, seats: capacidad } : t)),
      ),
    }));

    scheduleWrite(`seats:${rowKey(plantillaId, tableId)}`, STEPPER_DEBOUNCE_MS, () => {
      void persistPlantillaMesa(set, get, plantillaId, tableId, { capacidad });
    });
  },

  setShape: (tableId, shape) => {
    const state = get();
    const plantillaId = state.editingTemplateId;
    const row = state.rawByKey[rowKey(plantillaId, tableId)];
    if (!row) return;
    // `rectangular` y `barra` también se dibujan como cuadradas: si el usuario
    // pulsa la forma que ya está mostrando, no se toca nada y no se pierde la
    // forma real guardada en el backend.
    if (toUiShape(row.forma) === shape) return;

    const size = Number(row.ancho) || DEFAULT_SIZE_BY_SHAPE[shape];
    set({
      templates: mapEditingTables(state, (tables) =>
        tables.map((t) => (t.id === tableId ? { ...t, shape } : t)),
      ),
    });
    void persistPlantillaMesa(set, get, plantillaId, tableId, {
      forma: shape === "circle" ? "redonda" : "cuadrada",
      // Una mesa redonda exige ancho == alto == diámetro.
      ...(shape === "circle" ? { ancho: size, alto: size } : {}),
    });
  },

  setStatus: (tableId, status, occupantName) =>
    set((state) => ({
      templates: mapTableEverywhere(state.templates, tableId, (t) => ({
        ...t,
        status,
        occupantName: status === "free" ? undefined : (occupantName ?? t.occupantName),
      })),
    })),

  selectTable: (tableId) => set({ selectedTableId: tableId }),
}));

type SetState = (partial: Partial<FloorPlanState> | ((state: FloorPlanState) => Partial<FloorPlanState>)) => void;
type GetState = () => FloorPlanState;

async function persistPlantillaMesa(
  set: SetState,
  get: GetState,
  plantillaId: string,
  mesaId: string,
  patch: UpdatePlantillaMesaInput,
): Promise<void> {
  const key = rowKey(plantillaId, mesaId);
  const previous = get().rawByKey[key];
  if (!previous) return;
  try {
    const updated = await api.updatePlantillaMesa(plantillaId, mesaId, patch);
    set((state) => ({
      rawByKey: { ...state.rawByKey, [key]: { ...updated, mesa: previous.mesa } },
      error: null,
    }));
  } catch (error) {
    // Se revierte a lo que el servidor tenía para no dejar la UI mintiendo.
    set((state) => ({
      error: messageOf(error),
      templates: state.templates.map((tpl) =>
        tpl.id === plantillaId
          ? {
              ...tpl,
              tables: tpl.tables.map((t) =>
                t.id === mesaId
                  ? {
                      ...toRestaurantTable(previous, undefined),
                      status: t.status,
                      occupantName: t.occupantName,
                    }
                  : t,
              ),
            }
          : tpl,
      ),
    }));
  }
}

/**
 * Carga el plano una sola vez por sesión. Se monta en `AppShell`, así que
 * está activo en cada pantalla de staff que lee mesas (Mesas, Mesero,
 * Reservaciones, Comandas): es idempotente.
 */
export function useFloorPlanBootstrap(): void {
  const status = useFloorPlanStore((state) => state.status);
  const load = useFloorPlanStore((state) => state.load);
  const refreshPlano = useFloorPlanStore((state) => state.refreshPlano);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  // No hay WebSocket: sin este intervalo, una mesa que otro mesero ocupa
  // desde OTRO dispositivo (o libera al cobrar/anular) sólo se ve al
  // refrescar a mano — es exactamente el mismo problema que ya se resolvió
  // para el panel de Comandas (mismo patrón: 15s, se salta el tick si ya hay
  // una carga en curso). `refreshPlano()` es liviano: sólo trae `GET /plano`
  // y reconcilia estado/ocupante, no vuelve a traer plantillas completas.
  useEffect(() => {
    const POLL_INTERVAL_MS = 15_000;
    const interval = setInterval(() => {
      if (useFloorPlanStore.getState().status === "loading") return;
      void refreshPlano();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshPlano]);
}

/**
 * La distribución que el restaurante está usando ahora mismo. Es la que deben
 * leer Mesero, Reservaciones y el enlace público: no cambia porque alguien
 * abra otra plantilla en el editor.
 */
export function useActiveTemplate(): FloorPlanTemplate {
  return useFloorPlanStore(
    (state) => state.templates.find((tpl) => tpl.id === state.activeTemplateId) ?? EMPTY_TEMPLATE,
  );
}

/** La distribución abierta en el editor de plano. */
export function useEditingTemplate(): FloorPlanTemplate {
  return useFloorPlanStore(
    (state) => state.templates.find((tpl) => tpl.id === state.editingTemplateId) ?? EMPTY_TEMPLATE,
  );
}

export function useSelectedTable(): RestaurantTable | null {
  return useFloorPlanStore((state) => {
    const editing = state.templates.find((tpl) => tpl.id === state.editingTemplateId);
    if (!editing || !state.selectedTableId) return null;
    return editing.tables.find((t) => t.id === state.selectedTableId) ?? null;
  });
}
