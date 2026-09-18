import type {
  ActualizarSuscripcionPushInput,
  AddComandaItemInput,
  ApiClient,
  Categoria,
  ClaveVapid,
  Cobro,
  CobroPago,
  CobrarMesaInput,
  ColaDespachoItem,
  Comanda,
  ComandaEnCola,
  ComandaItem,
  CuentaMesa,
  CreateComandaInput,
  CreatePlantillaInput,
  CreatePlantillaMesaInput,
  CreateProductoInput,
  CreateReservacionInput,
  EstadoMesa,
  FormaMesa,
  FuenteTasa,
  Mesa,
  MesaEstado,
  OrdenReporteProducto,
  PeriodoReporte,
  Plantilla,
  PlantillaMesa,
  Producto,
  ProductoVendido,
  ReporteVentas,
  Reservacion,
  Salon,
  DivisaTasa,
  SuscripcionPush,
  SuscripcionPushCreada,
  SuscripcionPushInput,
  TasaDivisa,
  TemaPush,
  TurnoServicio,
  UpdateMesaInput,
  VentaPunto,
  VentaResumen,
  UpdatePlantillaInput,
  UpdatePlantillaMesaInput,
  UpdateProductoInput,
  UploadImagenResult,
} from "./types";
import { ApiError } from "./types";
import { seedTemplates } from "@/lib/mockData";

/**
 * In-memory mock backend.
 *
 * There is no live NestJS backend to develop against yet, so every screen
 * built on top of this app runs against this fixture data — shaped exactly
 * like `ApiClient` so `src/api/index.ts` can swap it for `httpClient.ts`
 * (real fetch calls) by only setting `VITE_API_URL`. All names below are
 * synthetic demo data, consistent with the ones already seeded in
 * `src/lib/mockData.ts` for the floor plan editor (same table ids/occupant
 * names) so the two screens tell one coherent story.
 */

function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function money(value: number): string {
  return value.toFixed(2);
}

// Mirrors the backend's real validation (CONTRACT.md, sección de uploads) so
// the mock rejects the same files the real API would.
const TIPOS_IMAGEN_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const TAMANO_MAXIMO_IMAGEN_BYTES = 5 * 1024 * 1024;

function todayAt(hours: number, minutes = 0): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/**
 * Un instante N minutos en el pasado.
 *
 * Las comandas VIVAS del seed se fechan con esto y no con una hora de reloj
 * fija, por dos razones que se notan en cuanto abres la app fuera de la hora
 * de la cena:
 *
 * 1. **El FIFO se rompía.** Un seed fechado "hoy a las 20:10" está en el
 *    FUTURO si abres el dev server a las 3 de la tarde, así que un pedido
 *    recién enviado aparecía ANTES que él en la cola — justo al revés de lo
 *    que la pantalla promete. Detectado ejecutando el flujo end-to-end, no
 *    leyendo el código.
 * 2. **`minutosEnCola` daba 0 en todas.** Con la hora en el futuro la resta
 *    sale negativa y queda clampeada a cero, así que el dato más importante
 *    del KDS —cuánto lleva esperando esto— era siempre "0 min".
 */
function minutosAtras(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

// --- Mock de `GET /reportes/ventas` -------------------------------------
// El mock sólo tiene datos fabricados para "hoy" (`cobrosHoy`), así que
// cualquier otro día operativo del tramo pedido viene en cero — es lo que una
// `serie` "densa" real haría de todos modos si ese día no tuvo ventas.
//
// ⚠️ La unidad de venta es el COBRO, no la comanda: `v_venta_dia` agrupa por
// `cobro.fecha_operativa` y su columna `comandas` pasó a llamarse `cobros`.

const ZERO_RESUMEN: VentaResumen = {
  cobros: 0,
  comensales: 0,
  totalUsd: "0.00",
  ventasUsd: "0.00",
  propinasUsd: "0.00",
  descuentosUsd: "0.00",
  impuestosUsd: "0.00",
  ticketPromedioUsd: "0.0000",
};

function sumResumen(cobros: Cobro[]): VentaResumen {
  const total = cobros.length;
  const comensales = cobros.reduce((sum, c) => sum + c.comensales, 0);
  const totalUsd = cobros.reduce((sum, c) => sum + Number(c.total), 0);
  const propinasUsd = cobros.reduce((sum, c) => sum + Number(c.propina), 0);
  const descuentosUsd = cobros.reduce((sum, c) => sum + Number(c.descuento), 0);
  const impuestosUsd = cobros.reduce((sum, c) => sum + Number(c.impuesto), 0);
  return {
    cobros: total,
    comensales,
    totalUsd: money(totalUsd),
    // Igual que la vista: `ventas_usd` EXCLUYE la propina, que es del mesero.
    ventasUsd: money(totalUsd - propinasUsd),
    propinasUsd: money(propinasUsd),
    descuentosUsd: money(descuentosUsd),
    impuestosUsd: money(impuestosUsd),
    ticketPromedioUsd: total === 0 ? "0.0000" : (totalUsd / total).toFixed(4),
  };
}

/** Suma varios `VentaResumen` (p. ej. una `serie`) en uno solo. */
function reduceResumenes(resumenes: VentaResumen[]): VentaResumen {
  const cobros = resumenes.reduce((sum, r) => sum + r.cobros, 0);
  const comensales = resumenes.reduce((sum, r) => sum + r.comensales, 0);
  const sumField = (key: keyof Omit<VentaResumen, "cobros" | "comensales" | "ticketPromedioUsd">) =>
    resumenes.reduce((sum, r) => sum + Number(r[key]), 0);
  const totalUsd = sumField("totalUsd");
  return {
    cobros,
    comensales,
    totalUsd: money(totalUsd),
    ventasUsd: money(sumField("ventasUsd")),
    propinasUsd: money(sumField("propinasUsd")),
    descuentosUsd: money(sumField("descuentosUsd")),
    impuestosUsd: money(sumField("impuestosUsd")),
    ticketPromedioUsd: cobros === 0 ? "0.0000" : (totalUsd / cobros).toFixed(4),
  };
}

/** Escala un resumen por un factor (para fabricar una comparación creíble). */
function scaleResumen(base: VentaResumen, factor: number): VentaResumen {
  if (base.cobros === 0) return ZERO_RESUMEN;
  const cobros = Math.max(1, Math.round(base.cobros * factor));
  const totalUsd = Number(base.totalUsd) * factor;
  return {
    cobros,
    comensales: Math.max(1, Math.round(base.comensales * factor)),
    totalUsd: money(totalUsd),
    ventasUsd: money(Number(base.ventasUsd) * factor),
    propinasUsd: money(Number(base.propinasUsd) * factor),
    descuentosUsd: money(Number(base.descuentosUsd) * factor),
    impuestosUsd: money(Number(base.impuestosUsd) * factor),
    ticketPromedioUsd: (totalUsd / cobros).toFixed(4),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shiftIsoDate(fecha: string, days: number): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Misma partición de turnos que la función SQL `hayai_turno` del backend. */
function turnoDe(hour: number): TurnoServicio {
  if (hour >= 5 && hour < 11) return "desayuno";
  if (hour >= 11 && hour < 17) return "almuerzo";
  if (hour >= 17 && hour < 23) return "cena";
  return "madrugada";
}

/**
 * Reporte de ventas por período fabricado a partir de `cobrosHoy` — el mock no
 * tiene histórico real, así que sólo el día operativo actual trae datos y el
 * resto del tramo (días/meses anteriores) queda en cero. Suficiente para
 * probar la UI (selector, comparación, serie) sin backend real corriendo.
 */
function buildReporteVentas(periodo: PeriodoReporte, fechaInput: string | undefined): ReporteVentas {
  const now = new Date();
  const hoy = isoDate(now);
  const ancla = fechaInput ?? hoy;
  const esHoyElAncla = ancla === hoy;

  if (periodo === "dia") {
    const totalHoy = sumResumen(cobrosHoy());
    const turnos: VentaPunto["clave"][] = ["desayuno", "almuerzo", "cena", "madrugada"];
    const porTurno = new Map<string, Cobro[]>(turnos.map((t) => [t, []]));
    if (esHoyElAncla) {
      for (const cobro of cobrosHoy()) {
        porTurno.get(cobro.turno)?.push(cobro);
      }
    }
    const serie: VentaPunto[] = turnos.map((clave) => ({
      clave,
      ...sumResumen(porTurno.get(clave) ?? []),
    }));
    const diaAnterior = shiftIsoDate(ancla, -1);
    return {
      periodo,
      fecha: ancla,
      desde: ancla,
      hasta: ancla,
      enCurso: esHoyElAncla,
      total: reduceResumenes(serie),
      granularidad: "turno",
      serie,
      comparacion: {
        desde: diaAnterior,
        hasta: diaAnterior,
        total: scaleResumen(esHoyElAncla ? totalHoy : ZERO_RESUMEN, 0.82),
      },
    };
  }

  const anclaDate = new Date(`${ancla}T00:00:00`);

  if (periodo === "mes") {
    const year = anclaDate.getFullYear();
    const month = anclaDate.getMonth();
    const esMesActual = year === now.getFullYear() && month === now.getMonth();
    const ultimoDiaMes = new Date(year, month + 1, 0).getDate();
    const hastaDiaNum = esMesActual ? now.getDate() : ultimoDiaMes;
    const mesStr = `${year}-${pad2(month + 1)}`;
    const serie: VentaPunto[] = [];
    for (let dia = 1; dia <= hastaDiaNum; dia += 1) {
      const clave = `${mesStr}-${pad2(dia)}`;
      const esHoyBucket = esHoyElAncla && dia === now.getDate();
      serie.push({ clave, ...(esHoyBucket ? sumResumen(cobrosHoy()) : ZERO_RESUMEN) });
    }
    const total = reduceResumenes(serie);
    const mesAnteriorDate = new Date(year, month - 1, 1);
    const diasMesAnterior = new Date(year, month, 0).getDate();
    const enCurso = esMesActual;
    return {
      periodo,
      fecha: ancla,
      desde: `${mesStr}-01`,
      hasta: `${mesStr}-${pad2(hastaDiaNum)}`,
      enCurso,
      total,
      granularidad: "dia",
      serie,
      comparacion: {
        desde: isoDate(mesAnteriorDate),
        hasta: isoDate(new Date(mesAnteriorDate.getFullYear(), mesAnteriorDate.getMonth(), enCurso ? Math.min(hastaDiaNum, diasMesAnterior) : diasMesAnterior)),
        total: scaleResumen(total, 0.85),
      },
    };
  }

  // periodo === "anio"
  const year = anclaDate.getFullYear();
  const esAnioActual = year === now.getFullYear();
  const ultimoMes = esAnioActual ? now.getMonth() : 11;
  const serie: VentaPunto[] = [];
  for (let month = 0; month <= ultimoMes; month += 1) {
    const clave = `${year}-${pad2(month + 1)}`;
    const esMesBucket = esAnioActual && month === now.getMonth();
    serie.push({
      clave,
      ...(esMesBucket ? sumResumen(cobrosHoy()) : ZERO_RESUMEN),
    });
  }
  const total = reduceResumenes(serie);
  const enCurso = esAnioActual;
  return {
    periodo,
    fecha: ancla,
    desde: `${year}-01-01`,
    hasta: `${year}-${pad2(ultimoMes + 1)}-${pad2(new Date(year, ultimoMes + 1, 0).getDate())}`,
    enCurso,
    total,
    granularidad: "mes",
    serie,
    comparacion: {
      desde: `${year - 1}-01-01`,
      hasta: enCurso
        ? `${year - 1}-${pad2(ultimoMes + 1)}-${pad2(new Date(year - 1, ultimoMes + 1, 0).getDate())}`
        : `${year - 1}-12-31`,
      total: scaleResumen(total, 0.85),
    },
  };
}

function shortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `R-${out}`;
}

// ---------------------------------------------------------------------------
// Seed: plano (salón + plantillas + mesas)
//
// Se deriva del layout de demo de `src/lib/mockData.ts` para no mantener dos
// juegos de coordenadas, pero ya con la forma REAL del backend: la identidad
// de la mesa (`Mesa`) separada de su sitio en el plano (`PlantillaMesa`), y el
// estado libre/ocupada/reservada NO almacenado sino derivado de las comandas y
// reservaciones vivas — igual que hace la vista `v_mesa_estado` en producción.
// ---------------------------------------------------------------------------

const SALON_ID = "sal-principal";
const PLAN_WIDTH = 1200;
const PLAN_HEIGHT = 700;

const salones: Salon[] = [{ id: SALON_ID, nombre: "Salón principal", orden: 0, activo: true }];

let plantillas: Plantilla[] = seedTemplates.map((tpl, index) => ({
  id: tpl.id,
  salonId: SALON_ID,
  nombre: tpl.name,
  descripcion: null,
  anchoPlano: String(PLAN_WIDTH),
  altoPlano: String(PLAN_HEIGHT),
  activa: index === 0,
}));

let mesas: Mesa[] = seedTemplates.flatMap((tpl) =>
  tpl.tables.map((table) => ({
    id: table.id,
    salonId: SALON_ID,
    etiqueta: table.label,
    capacidadDefault: table.seats,
    formaDefault: (table.shape === "circle" ? "redonda" : "cuadrada") as FormaMesa,
    activa: true,
  })),
);

let plantillaMesas: PlantillaMesa[] = seedTemplates.flatMap((tpl) =>
  tpl.tables.map((table) => ({
    plantillaId: tpl.id,
    mesaId: table.id,
    // El editor trabaja en centros; el backend guarda la esquina superior izquierda.
    posX: String(table.x - table.size / 2),
    posY: String(table.y - table.size / 2),
    ancho: String(table.size),
    alto: String(table.size),
    rotacion: 0,
    forma: (table.shape === "circle" ? "redonda" : "cuadrada") as FormaMesa,
    capacidad: table.seats,
    bloqueada: false,
  })),
);

function mesaById(id: string): Mesa {
  const found = mesas.find((m) => m.id === id);
  if (!found) throw new ApiError("Mesa no encontrada", 404);
  return found;
}

function plantillaById(id: string): Plantilla {
  const found = plantillas.find((p) => p.id === id);
  if (!found) throw new ApiError("La plantilla no existe", 404);
  return found;
}

function withMesa(row: PlantillaMesa): PlantillaMesa {
  return { ...row, mesa: mesas.find((m) => m.id === row.mesaId) };
}

function nextMockId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Tasa del día. El backend real la exige para cobrar (congela `tasaValor` y
 * `totalBs` en la comanda), así que el mock arranca con una registrada para
 * que el modo demo pueda cerrar cuentas sin configurar nada. Shape real de
 * `GET /tasa/vigente`: una entrada por divisa, cualquiera puede ser `null`.
 */
function tasaDemo(divisa: DivisaTasa, valor: string): TasaDivisa {
  return {
    id: `tasa-${divisa.toLowerCase()}-demo`,
    restauranteId: "restaurante-demo",
    fecha: new Date().toISOString().slice(0, 10),
    divisa,
    valor,
    fuente: "manual",
    registradaPorId: null,
    creadaEn: new Date().toISOString(),
  };
}

let tasaUsd: TasaDivisa | null = tasaDemo("USD", "40.0000");
let tasaEur: TasaDivisa | null = tasaDemo("EUR", "43.5000");

// ---------------------------------------------------------------------------
// Seed: menú
// ---------------------------------------------------------------------------

let categorias: Categoria[] = [
  { id: "cat-entradas", nombre: "Entradas", orden: 1, activa: true },
  { id: "cat-fuertes", nombre: "Platos fuertes", orden: 2, activa: true },
  { id: "cat-bebidas", nombre: "Bebidas", orden: 3, activa: true },
  { id: "cat-postres", nombre: "Postres", orden: 4, activa: true },
];

let productos: Producto[] = [
  { id: "p-1", categoriaId: "cat-entradas", categoriaNombre: "Entradas", nombre: "Tequeños (6 u.)", precio: money(6), destino: "cocina", disponible: true, activo: true, orden: 1 },
  { id: "p-2", categoriaId: "cat-entradas", categoriaNombre: "Entradas", nombre: "Empanada de carne", precio: money(3.5), destino: "cocina", disponible: true, activo: true, orden: 2 },
  { id: "p-3", categoriaId: "cat-entradas", categoriaNombre: "Entradas", nombre: "Ceviche mixto", precio: money(9), destino: "cocina", disponible: true, activo: true, orden: 3 },
  { id: "p-4", categoriaId: "cat-fuertes", categoriaNombre: "Platos fuertes", nombre: "Pabellón criollo", precio: money(14), destino: "cocina", disponible: true, activo: true, orden: 1 },
  { id: "p-5", categoriaId: "cat-fuertes", categoriaNombre: "Platos fuertes", nombre: "Solomo a la pimienta", precio: money(18), destino: "cocina", disponible: true, activo: true, orden: 2 },
  { id: "p-6", categoriaId: "cat-fuertes", categoriaNombre: "Platos fuertes", nombre: "Pescado a la plancha", precio: money(16), destino: "cocina", disponible: false, activo: true, orden: 3 },
  { id: "p-7", categoriaId: "cat-fuertes", categoriaNombre: "Platos fuertes", nombre: "Pasta al pesto", precio: money(12), destino: "cocina", disponible: true, activo: true, orden: 4 },
  { id: "p-8", categoriaId: "cat-bebidas", categoriaNombre: "Bebidas", nombre: "Papelón con limón", precio: money(3), destino: "barra", disponible: true, activo: true, orden: 1 },
  { id: "p-9", categoriaId: "cat-bebidas", categoriaNombre: "Bebidas", nombre: "Cerveza nacional", precio: money(4), destino: "barra", disponible: true, activo: true, orden: 2 },
  { id: "p-10", categoriaId: "cat-bebidas", categoriaNombre: "Bebidas", nombre: "Copa de vino tinto", precio: money(7), destino: "barra", disponible: true, activo: true, orden: 3 },
  { id: "p-11", categoriaId: "cat-postres", categoriaNombre: "Postres", nombre: "Quesillo", precio: money(5), destino: "cocina", disponible: true, activo: true, orden: 1 },
  { id: "p-12", categoriaId: "cat-postres", categoriaNombre: "Postres", nombre: "Torta tres leches", precio: money(5.5), destino: "cocina", disponible: true, activo: true, orden: 2 },
];

function productoById(id: string): Producto {
  const found = productos.find((p) => p.id === id);
  if (!found) throw new ApiError("El producto referenciado no existe", 422);
  return found;
}

/**
 * `comanda.total` es SÓLO la suma de sus líneas vivas — ni descuento, ni
 * impuesto, ni propina: eso se negocia sobre la cuenta de la mesa y vive en el
 * `Cobro`. Misma regla que `recalcularTotal` en el backend.
 */
function recomputeTotals(comanda: Comanda): void {
  const vivas = comanda.items.filter((item) => item.canceladoEn == null);
  comanda.total = money(vivas.reduce((sum, item) => sum + Number(item.totalLinea), 0));
}

// ---------------------------------------------------------------------------
// Seed: comandas y cobros
//
// El modelo nuevo: una mesa acumula VARIAS comandas vivas. `comandas` guarda
// TODAS (vivas, cobradas y anuladas) igual que la tabla real; quién está viva,
// quién está en la cola y quién se puede cobrar se deriva de los tres hechos
// (`despachadaEn`, `anuladaEn`, `cobroId`), nunca de un campo de estado
// escrito a mano.
//
// Mesas ocupadas del seed (coinciden con src/lib/mockData.ts): t1, t5, t7,
// t11, t16. t1 y t5 tienen DOS comandas cada una para que el caso de varias
// comandas por mesa se vea sin tener que fabricarlo a mano.
// ---------------------------------------------------------------------------

let contadorComanda = 0;
let contadorCobro = 0;

function buildItem(productoId: string, cantidad: number, nota?: string): ComandaItem {
  const producto = productoById(productoId);
  return {
    id: uid("ci"),
    productoId,
    nombreSnap: producto.nombre,
    precioUnitarioSnap: producto.precio,
    destinoSnap: producto.destino,
    cantidad,
    totalLinea: money(Number(producto.precio) * cantidad),
    nota: nota ?? null,
    canceladoEn: null,
  };
}

/**
 * `estado` es DERIVADO, igual que el trigger `comanda_estado` del backend: se
 * calcula desde los tres hechos en vez de guardarse. Así el mock no puede
 * quedar en un estado imposible (p. ej. cobrada sin despachar).
 */
function estadoDeComanda(c: Pick<Comanda, "despachadaEn" | "anuladaEn" | "cobroId">): Comanda["estado"] {
  if (c.anuladaEn) return "anulada";
  if (c.cobroId) return "cobrada";
  return c.despachadaEn ? "despachada" : "pendiente";
}

function withEstado(comanda: Comanda): Comanda {
  return { ...comanda, estado: estadoDeComanda(comanda) };
}

interface SeedComanda {
  id: string;
  mesaId: string;
  comensales: number;
  creadaEn: string;
  /** `null` = sigue en la cola de despacho. */
  despachadaEn: string | null;
  items: ComandaItem[];
  notas?: string;
}

function seedComanda(seed: SeedComanda): Comanda {
  contadorComanda += 1;
  const comanda: Comanda = {
    id: seed.id,
    tipo: "mesa",
    mesaId: seed.mesaId,
    mesaEtiqueta: mesas.find((m) => m.id === seed.mesaId)?.etiqueta ?? null,
    salonId: SALON_ID,
    reservacionId: null,
    numeroDia: contadorComanda,
    comensales: seed.comensales,
    meseroId: null,
    estado: "pendiente",
    creadaEn: seed.creadaEn,
    despachadaEn: seed.despachadaEn,
    anuladaEn: null,
    cobroId: null,
    total: "0.00",
    notas: seed.notas ?? null,
    items: seed.items,
  };
  recomputeTotals(comanda);
  return withEstado(comanda);
}

let comandas: Comanda[] = [
  // Mesa 7: todo despachado → es la cuenta por cobrar lista del seed.
  seedComanda({
    id: "cmd-t7-1",
    mesaId: "t7",
    comensales: 6,
    creadaEn: minutosAtras(95),
    despachadaEn: minutosAtras(80),
    items: [buildItem("p-3", 2), buildItem("p-4", 3)],
  }),
  seedComanda({
    id: "cmd-t7-2",
    mesaId: "t7",
    comensales: 6,
    creadaEn: minutosAtras(70),
    despachadaEn: minutosAtras(55),
    items: [buildItem("p-11", 6)],
  }),
  // Mesa 1: una ronda ya despachada + otra todavía en cocina.
  seedComanda({
    id: "cmd-t1-1",
    mesaId: "t1",
    comensales: 2,
    creadaEn: minutosAtras(60),
    despachadaEn: minutosAtras(45),
    items: [buildItem("p-2", 2), buildItem("p-9", 2)],
  }),
  // Mesa 5: dos rondas, la primera ya despachada.
  seedComanda({
    id: "cmd-t5-1",
    mesaId: "t5",
    comensales: 4,
    creadaEn: minutosAtras(40),
    despachadaEn: minutosAtras(28),
    items: [buildItem("p-1", 1), buildItem("p-10", 4)],
  }),
  // A partir de aquí, lo que está EN LA COLA, del más viejo al más nuevo.
  // La de 22 min entra pasada del umbral de atraso (15 min) a propósito, para
  // que el marcador de "pedido atrasado" del KDS se vea sin tener que esperar.
  seedComanda({
    id: "cmd-t16-1",
    mesaId: "t16",
    comensales: 4,
    creadaEn: minutosAtras(22),
    despachadaEn: null,
    items: [buildItem("p-7", 2), buildItem("p-9", 3)],
  }),
  seedComanda({
    id: "cmd-t1-2",
    mesaId: "t1",
    comensales: 2,
    creadaEn: minutosAtras(14),
    despachadaEn: null,
    items: [buildItem("p-4", 2, "Sin picante")],
  }),
  seedComanda({
    id: "cmd-t11-1",
    mesaId: "t11",
    comensales: 2,
    creadaEn: minutosAtras(8),
    despachadaEn: null,
    items: [buildItem("p-8", 2)],
  }),
  seedComanda({
    id: "cmd-t5-2",
    mesaId: "t5",
    comensales: 4,
    creadaEn: minutosAtras(3),
    despachadaEn: null,
    items: [buildItem("p-5", 3)],
    notas: "Mesa con apuro, vuelo en dos horas",
  }),
];

let cobros: Cobro[] = [];

/**
 * Facturas ya emitidas hoy, para que el reporte de ventas no arranque vacío.
 * Se fabrican con el mismo camino que un cobro real: comandas despachadas que
 * pasan a tener `cobroId`, y un `Cobro` cuyos pagos cuadran con el total —
 * `v_cobro_descuadre` tiene que seguir dando 0 filas también aquí.
 */
function seedCobro(
  mesaId: string,
  creadaEn: string,
  cobradoEn: string,
  comensales: number,
  lineas: ComandaItem[],
  propina: number,
  metodo: CobroPago["metodo"],
): void {
  const comanda = seedComanda({
    id: uid("cmd-h"),
    mesaId,
    comensales,
    creadaEn,
    despachadaEn: cobradoEn,
    items: lineas,
  });
  const subtotal = Number(comanda.total);
  const total = subtotal + propina;
  const tasa = tasaUsd?.valor ?? "40.0000";
  contadorCobro += 1;
  const cobroId = uid("cob");
  comandas = [...comandas, { ...comanda, cobroId, estado: "cobrada" }];
  cobros = [
    ...cobros,
    {
      id: cobroId,
      mesaId,
      salonId: SALON_ID,
      numeroDia: contadorCobro,
      fechaOperativa: isoDate(new Date(cobradoEn)),
      turno: turnoDe(new Date(cobradoEn).getHours()),
      comensales,
      subtotal: money(subtotal),
      descuento: "0.00",
      impuesto: "0.00",
      propina: money(propina),
      total: money(total),
      tasaValor: tasa,
      totalBs: money(total * Number(tasa)),
      cobradoEn,
      anuladoEn: null,
      pagos: [
        {
          id: uid("pag"),
          metodo,
          moneda: "USD",
          monto: money(total),
          tasaAplicada: null,
          montoUsd: money(total),
          referencia: metodo === "pago_movil" ? `0${contadorCobro}4455667` : null,
          recibidoEn: cobradoEn,
        },
      ],
      comandas: [{ ...comanda, cobroId, estado: "cobrada" }],
      mesa: mesas.find((m) => m.id === mesaId) ?? null,
    },
  ];
}

seedCobro("t2", todayAt(12, 15), todayAt(13, 20), 2, [buildItem("p-4", 2), buildItem("p-9", 2)], 3, "efectivo_usd");
seedCobro("t4", todayAt(12, 40), todayAt(14, 5), 4, [buildItem("p-4", 4), buildItem("p-10", 4), buildItem("p-11", 2)], 0, "pago_movil");
seedCobro("t9", todayAt(13, 0), todayAt(14, 30), 6, [buildItem("p-1", 2), buildItem("p-5", 6), buildItem("p-9", 6)], 12, "efectivo_usd");
seedCobro("t12", todayAt(18, 0), todayAt(19, 0), 2, [buildItem("p-2", 2), buildItem("p-4", 2)], 0, "punto");
seedCobro("t13", todayAt(18, 20), todayAt(19, 15), 2, [buildItem("p-3", 1), buildItem("p-7", 2), buildItem("p-10", 2)], 5, "efectivo_usd");

/** Las facturas del día operativo en curso, no anuladas. */
function cobrosHoy(): Cobro[] {
  const hoy = isoDate(new Date());
  return cobros.filter((c) => c.fechaOperativa === hoy && !c.anuladoEn);
}

/** Comandas vivas: ni cobradas ni anuladas. Son las que ocupan una mesa. */
function comandasVivas(mesaId?: string): Comanda[] {
  return comandas.filter(
    (c) =>
      c.cobroId == null &&
      c.anuladaEn == null &&
      (mesaId === undefined || c.mesaId === mesaId),
  );
}

function comandaById(id: string): Comanda {
  const found = comandas.find((c) => c.id === id);
  if (!found) throw new ApiError("Comanda no encontrada", 404);
  return found;
}

/**
 * Las líneas sólo se pueden tocar mientras la comanda siga `pendiente`
 * (trigger `comanda_item_solo_pendiente` en el backend): se anula una línea
 * antes de despachar, no se le añaden a un pedido que ya salió —rompería el
 * FIFO— y no se toca nada de una comanda ya cobrada.
 */
function requerirPendiente(comanda: Comanda): void {
  if (comanda.anuladaEn) throw new ApiError("Esa comanda está anulada", 409);
  if (comanda.cobroId) {
    throw new ApiError("Esa comanda ya se cobró: sus líneas no se pueden cambiar", 409);
  }
  if (comanda.despachadaEn) {
    throw new ApiError("Esa comanda ya salió de cocina: sus líneas no se pueden cambiar", 409);
  }
}

function replaceComanda(next: Comanda): Comanda {
  const conEstado = withEstado(next);
  comandas = comandas.map((c) => (c.id === conEstado.id ? conEstado : c));
  return conEstado;
}

/** Réplica en memoria de una fila de `v_cuenta_mesa`. */
function cuentaDeMesaRow(mesaId: string): CuentaMesa | null {
  const vivas = comandasVivas(mesaId);
  if (vivas.length === 0) return null;
  const mesa = mesas.find((m) => m.id === mesaId);
  const despachadas = vivas.filter((c) => c.despachadaEn != null);
  const enCocina = vivas.filter((c) => c.despachadaEn == null);
  const sum = (list: Comanda[]) => list.reduce((acc, c) => acc + Number(c.total), 0);
  const ocupadaDesde = vivas.reduce(
    (min, c) => (c.creadaEn < min ? c.creadaEn : min),
    vivas[0].creadaEn,
  );
  return {
    mesaId,
    mesaEtiqueta: mesa?.etiqueta ?? "—",
    salonId: SALON_ID,
    salonNombre: salones.find((s) => s.id === SALON_ID)?.nombre ?? null,
    comandas: vivas.length,
    comandasPorCobrar: despachadas.length,
    comandasEnCocina: enCocina.length,
    cuentaTotal: money(sum(vivas)),
    totalPorCobrar: money(sum(despachadas)),
    totalEnCocina: money(sum(enCocina)),
    comensales: Math.max(...vivas.map((c) => c.comensales)),
    ocupadaDesde,
    minutosOcupada: Math.max(
      0,
      Math.round((Date.now() - new Date(ocupadaDesde).getTime()) / 60_000),
    ),
    meseroId: null,
    reservacionId: vivas.find((c) => c.reservacionId)?.reservacionId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Seed: reservaciones de hoy
// ---------------------------------------------------------------------------

let reservaciones: Reservacion[] = [
  {
    id: "res-1",
    mesaId: "t3",
    mesaEtiqueta: "M-3",
    clienteNombre: "Familia Restrepo",
    clienteTelefono: "0414-1234567",
    personas: 4,
    iniciaEn: todayAt(20, 0),
    terminaEn: todayAt(21, 30),
    estado: "confirmada",
    origen: "personal",
    codigoPublico: uid("pub"),
    codigoCorto: shortCode(),
  },
  {
    id: "res-2",
    mesaId: "t8",
    mesaEtiqueta: "M-8",
    clienteNombre: "Ana Sofía Reyes",
    clienteTelefono: "0424-2223344",
    personas: 6,
    iniciaEn: todayAt(20, 30),
    terminaEn: todayAt(22, 0),
    estado: "confirmada",
    origen: "personal",
    codigoPublico: uid("pub"),
    codigoCorto: shortCode(),
  },
  {
    id: "res-3",
    mesaId: "t14",
    mesaEtiqueta: "M-14",
    clienteNombre: "Julián Cárdenas",
    personas: 4,
    iniciaEn: todayAt(21, 0),
    terminaEn: todayAt(22, 30),
    estado: "pendiente",
    origen: "enlace_publico",
    codigoPublico: uid("pub"),
    codigoCorto: shortCode(),
  },
  {
    id: "res-4",
    mesaId: null,
    mesaEtiqueta: null,
    clienteNombre: "Rodrigo Silva",
    clienteTelefono: "0412-9998877",
    personas: 2,
    iniciaEn: todayAt(21, 30),
    terminaEn: todayAt(23, 0),
    estado: "pendiente",
    origen: "enlace_publico",
    notas: "Pidió mesa en la terraza si es posible.",
    codigoPublico: uid("pub"),
    codigoCorto: shortCode(),
  },
  {
    id: "res-5",
    mesaId: "t15",
    mesaEtiqueta: "M-15",
    clienteNombre: "Grupo Peraza",
    personas: 4,
    iniciaEn: todayAt(13, 0),
    terminaEn: todayAt(14, 30),
    estado: "no_show",
    origen: "personal",
    codigoPublico: uid("pub"),
    codigoCorto: shortCode(),
  },
];

/** La reserva que YA está sentada en la mesa (`sent` en `v_mesa_estado`). */
function reservaSentadaDeMesa(mesaId: string): Reservacion | undefined {
  return reservaciones.find((r) => r.mesaId === mesaId && r.estado === "sentada");
}

/**
 * La PRÓXIMA reserva que pesa sobre la mesa (`rsv` en `v_mesa_estado`): sólo
 * las que todavía no llegaron, y sólo dentro de la ventana de −30 min a +2 h.
 * Va aparte de la sentada a propósito: aquélla es gente que ya está ahí.
 */
function proximaReservaDeMesa(mesaId: string): Reservacion | undefined {
  const ahora = Date.now();
  const desde = ahora - 30 * 60_000;
  const hasta = ahora + 2 * 60 * 60_000;
  return reservaciones
    .filter(
      (r) =>
        r.mesaId === mesaId &&
        (r.estado === "pendiente" || r.estado === "confirmada") &&
        new Date(r.iniciaEn).getTime() >= desde &&
        new Date(r.iniciaEn).getTime() <= hasta,
    )
    .sort((a, b) => a.iniciaEn.localeCompare(b.iniciaEn))[0];
}

/**
 * Misma regla que la vista `v_mesa_estado`, en memoria — incluida la rama que
 * el rediseño agregó: ⭐ una reserva SENTADA ocupa la mesa por sí sola, aunque
 * todavía no haya ninguna comanda. Sin ella, el check-in pintaría la mesa
 * ocupada de forma optimista y el siguiente refresco la devolvería a `libre`.
 */
function estadoDeMesa(mesaId: string, bloqueada: boolean): EstadoMesa {
  if (bloqueada) return "bloqueada";
  if (comandasVivas(mesaId).length > 0) return "ocupada";
  if (reservaSentadaDeMesa(mesaId)) return "ocupada";
  return proximaReservaDeMesa(mesaId) ? "reservada" : "libre";
}

// ---------------------------------------------------------------------------
// Seed: suscripciones Web Push
//
// No hay backend real que guarde nada de esto en modo demo, así que vive en
// memoria y se pierde al recargar — igual que el resto del mock. La clave
// VAPID de abajo es un PLACEHOLDER con la forma correcta (base64url, ~87
// caracteres, primer byte 0x04 como exige un punto P-256 sin comprimir) pero
// NO corresponde a un par de claves real: `pushManager.subscribe` puede
// rechazarla en el navegador. No importa para el modo demo — sin backend real
// tampoco hay quién mande el push — y `pushSubscription.ts` nunca deja que
// ese rechazo rompa la pantalla.
// ---------------------------------------------------------------------------

const VAPID_PUBLICA_DEMO =
  "BPlaceholderVapidPublicKeyForMockModeOnlyDoNotUseInProductionXXXXXXXXXXXXXXXXXXX";

interface SuscripcionPushSeed {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  temas: TemaPush[];
  etiqueta?: string;
  agenteUsuario?: string;
  creadaEn: string;
  renovadaEn: string;
}

let suscripcionesPush: SuscripcionPushSeed[] = [];

function toSuscripcionPush(row: SuscripcionPushSeed): SuscripcionPush {
  return {
    id: row.id,
    etiqueta: row.etiqueta ?? null,
    agenteUsuario: row.agenteUsuario ?? null,
    temas: row.temas,
    creadaEn: row.creadaEn,
    renovadaEn: row.renovadaEn,
  };
}

export const mockApi: ApiClient = {
  // --- Plano: salones, plantillas y mesas -------------------------------
  async listSalones() {
    return delay(salones.filter((s) => s.activo));
  },

  async listPlantillas(salonId: string) {
    return delay(plantillas.filter((p) => p.salonId === salonId));
  },

  async getPlantilla(plantillaId: string) {
    const plantilla = plantillaById(plantillaId);
    return delay({
      ...plantilla,
      mesas: plantillaMesas.filter((pm) => pm.plantillaId === plantillaId).map(withMesa),
    });
  },

  async createPlantilla(salonId: string, input: CreatePlantillaInput) {
    const nombre = input.nombre.trim();
    if (!nombre) throw new ApiError("El nombre de la plantilla es obligatorio", 422);
    const plantilla: Plantilla = {
      id: nextMockId("tpl"),
      salonId,
      nombre,
      descripcion: null,
      anchoPlano: String(input.anchoPlano ?? PLAN_WIDTH),
      altoPlano: String(input.altoPlano ?? PLAN_HEIGHT),
      activa: false,
    };
    plantillas = [...plantillas, plantilla];
    return delay(plantilla);
  },

  async updatePlantilla(plantillaId: string, input: UpdatePlantillaInput) {
    const current = plantillaById(plantillaId);
    const next: Plantilla = {
      ...current,
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.descripcion !== undefined ? { descripcion: input.descripcion } : {}),
      ...(input.anchoPlano !== undefined ? { anchoPlano: String(input.anchoPlano) } : {}),
      ...(input.altoPlano !== undefined ? { altoPlano: String(input.altoPlano) } : {}),
    };
    plantillas = plantillas.map((p) => (p.id === plantillaId ? next : p));
    return delay(next);
  },

  async deletePlantilla(plantillaId: string) {
    const plantilla = plantillaById(plantillaId);
    if (plantilla.activa) {
      throw new ApiError("No se puede eliminar la plantilla activa del salón", 409);
    }
    plantillas = plantillas.filter((p) => p.id !== plantillaId);
    plantillaMesas = plantillaMesas.filter((pm) => pm.plantillaId !== plantillaId);
    return delay(undefined);
  },

  async activarPlantilla(plantillaId: string) {
    const plantilla = plantillaById(plantillaId);
    plantillas = plantillas.map((p) =>
      p.salonId === plantilla.salonId ? { ...p, activa: p.id === plantillaId } : p,
    );
    const mesasEnPlano = new Set(
      plantillaMesas.filter((pm) => pm.plantillaId === plantillaId).map((pm) => pm.mesaId),
    );
    const reservacionesHuerfanas = reservaciones.filter(
      (r) =>
        r.mesaId !== null &&
        !mesasEnPlano.has(r.mesaId) &&
        (r.estado === "pendiente" || r.estado === "confirmada"),
    );
    return delay({
      plantilla: { ...plantilla, activa: true },
      reservacionesHuerfanas,
    });
  },

  async listMesas(salonId?: string) {
    // `mesas` sólo guarda las vivas — `deleteMesa` las saca del array, que es
    // el equivalente al `eliminada_en` del backend. Quitar una mesa del plano
    // (`deletePlantillaMesa`) no la toca: sigue aquí, con su etiqueta tomada.
    return delay(
      mesas
        .filter((m) => !salonId || m.salonId === salonId)
        .slice()
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, undefined, { numeric: true })),
    );
  },

  async createPlantillaMesa(plantillaId: string, input: CreatePlantillaMesaInput) {
    plantillaById(plantillaId);
    let mesaId = input.mesaId;
    if (!mesaId) {
      const etiqueta = (input.etiqueta ?? "").trim();
      if (!etiqueta) throw new ApiError("La etiqueta de la mesa es obligatoria", 422);
      if (mesas.some((m) => m.etiqueta.toLowerCase() === etiqueta.toLowerCase())) {
        throw new ApiError("Ya existe una mesa con ese número", 409);
      }
      const mesa: Mesa = {
        id: nextMockId("mesa"),
        salonId: SALON_ID,
        etiqueta,
        capacidadDefault: input.capacidad ?? 4,
        formaDefault: input.forma ?? "cuadrada",
        activa: true,
      };
      mesas = [...mesas, mesa];
      mesaId = mesa.id;
    } else {
      mesaById(mesaId);
    }
    if (plantillaMesas.some((pm) => pm.plantillaId === plantillaId && pm.mesaId === mesaId)) {
      throw new ApiError("Esa mesa ya está en el plano", 409);
    }
    const ancho = input.ancho ?? 78;
    const row: PlantillaMesa = {
      plantillaId,
      mesaId,
      posX: String(input.posX),
      posY: String(input.posY),
      ancho: String(ancho),
      alto: String(input.alto ?? ancho),
      rotacion: input.rotacion ?? 0,
      forma: input.forma ?? "cuadrada",
      capacidad: input.capacidad ?? 4,
      bloqueada: input.bloqueada ?? false,
    };
    plantillaMesas = [...plantillaMesas, row];
    return delay(withMesa(row));
  },

  async updatePlantillaMesa(
    plantillaId: string,
    mesaId: string,
    input: UpdatePlantillaMesaInput,
  ) {
    const idx = plantillaMesas.findIndex(
      (pm) => pm.plantillaId === plantillaId && pm.mesaId === mesaId,
    );
    if (idx === -1) throw new ApiError("Esa mesa no está en el plano", 404);
    if (input.capacidad !== undefined && (input.capacidad < 1 || input.capacidad > 50)) {
      throw new ApiError("La capacidad debe estar entre 1 y 50", 422);
    }
    const next: PlantillaMesa = {
      ...plantillaMesas[idx],
      ...(input.posX !== undefined ? { posX: String(input.posX) } : {}),
      ...(input.posY !== undefined ? { posY: String(input.posY) } : {}),
      ...(input.ancho !== undefined ? { ancho: String(input.ancho) } : {}),
      ...(input.alto !== undefined ? { alto: String(input.alto) } : {}),
      ...(input.rotacion !== undefined ? { rotacion: input.rotacion } : {}),
      ...(input.forma !== undefined ? { forma: input.forma } : {}),
      ...(input.capacidad !== undefined ? { capacidad: input.capacidad } : {}),
      ...(input.bloqueada !== undefined ? { bloqueada: input.bloqueada } : {}),
    };
    plantillaMesas = [...plantillaMesas.slice(0, idx), next, ...plantillaMesas.slice(idx + 1)];
    // El backend real NO embebe la mesa en el PATCH; se replica para que el
    // frontend no llegue a depender de algo que en producción no viene.
    return delay(next);
  },

  async deletePlantillaMesa(plantillaId: string, mesaId: string) {
    const exists = plantillaMesas.some(
      (pm) => pm.plantillaId === plantillaId && pm.mesaId === mesaId,
    );
    if (!exists) throw new ApiError("Esa mesa no está en el plano", 404);
    // Quita la mesa del plano; la identidad (`mesa`) sobrevive, igual que en el backend.
    plantillaMesas = plantillaMesas.filter(
      (pm) => !(pm.plantillaId === plantillaId && pm.mesaId === mesaId),
    );
    return delay(undefined);
  },

  async updateMesa(mesaId: string, input: UpdateMesaInput) {
    const current = mesaById(mesaId);
    if (input.etiqueta !== undefined) {
      const etiqueta = input.etiqueta.trim();
      if (!etiqueta) throw new ApiError("La etiqueta de la mesa es obligatoria", 422);
      const taken = mesas.some(
        (m) => m.id !== mesaId && m.etiqueta.toLowerCase() === etiqueta.toLowerCase(),
      );
      if (taken) throw new ApiError("Ya existe una mesa con ese número", 409);
    }
    const next: Mesa = {
      ...current,
      ...(input.etiqueta !== undefined ? { etiqueta: input.etiqueta.trim() } : {}),
      ...(input.capacidadDefault !== undefined
        ? { capacidadDefault: input.capacidadDefault }
        : {}),
      ...(input.formaDefault !== undefined ? { formaDefault: input.formaDefault } : {}),
      ...(input.activa !== undefined ? { activa: input.activa } : {}),
    };
    mesas = mesas.map((m) => (m.id === mesaId ? next : m));
    return delay(next);
  },

  async deleteMesa(mesaId: string) {
    mesaById(mesaId);
    // Borrado lógico de la identidad: se quita de todas las plantillas donde
    // estuviera dibujada y libera su etiqueta, igual que el backend real.
    mesas = mesas.filter((m) => m.id !== mesaId);
    plantillaMesas = plantillaMesas.filter((pm) => pm.mesaId !== mesaId);
    return delay(undefined);
  },

  async getPlano(salonId: string, plantillaId?: string) {
    const relevantes = plantillas.filter(
      (p) => p.salonId === salonId && (!plantillaId || p.id === plantillaId),
    );
    const rows: MesaEstado[] = [];
    for (const plantilla of relevantes) {
      for (const pm of plantillaMesas.filter((x) => x.plantillaId === plantilla.id)) {
        const mesa = mesas.find((m) => m.id === pm.mesaId);
        if (!mesa) continue;
        const estado = estadoDeMesa(mesa.id, pm.bloqueada);
        const vivas = comandasVivas(mesa.id);
        const sentada = reservaSentadaDeMesa(mesa.id);
        const proxima = proximaReservaDeMesa(mesa.id);
        const primeraComanda = vivas
          .map((c) => c.creadaEn)
          .sort((a, b) => a.localeCompare(b))[0];
        rows.push({
          salonId,
          plantillaId: plantilla.id,
          plantillaActiva: plantilla.activa,
          mesaId: mesa.id,
          etiqueta: mesa.etiqueta,
          estado,
          bloqueada: pm.bloqueada,
          comandas: vivas.length,
          comandasEnCocina: vivas.filter((c) => c.despachadaEn == null).length,
          comandasPorCobrar: vivas.filter((c) => c.despachadaEn != null).length,
          cuentaTotal: money(vivas.reduce((sum, c) => sum + Number(c.total), 0)),
          // El primer pedido o, si todavía no pidieron nada, el check-in.
          ocupadaDesde: primeraComanda ?? sentada?.iniciaEn ?? null,
          comensales: vivas.length > 0 ? Math.max(...vivas.map((c) => c.comensales)) : 0,
          reservacionId: proxima?.id ?? null,
          reservacionCliente: proxima?.clienteNombre ?? null,
          sentadaReservacionId: sentada?.id ?? null,
          sentadaCliente: sentada?.clienteNombre ?? null,
          sentadaEn: sentada ? (sentada.iniciaEn ?? null) : null,
        });
      }
    }
    return delay(rows);
  },

  // --- Menú -----------------------------------------------------------
  async listCategorias() {
    return delay(categorias.filter((c) => c.activa));
  },

  async createCategoria(nombre) {
    const trimmed = nombre.trim();
    if (!trimmed) throw new ApiError("El nombre de la categoría es obligatorio", 422);
    const categoria: Categoria = {
      id: uid("cat"),
      nombre: trimmed,
      orden: categorias.length + 1,
      activa: true,
    };
    categorias = [...categorias, categoria];
    return delay(categoria);
  },

  async listProductos() {
    return delay([...productos]);
  },

  async uploadProductoImagen(archivo: File): Promise<UploadImagenResult> {
    if (!TIPOS_IMAGEN_PERMITIDOS.has(archivo.type)) {
      throw new ApiError("Solo se permiten imágenes JPG, PNG o WEBP", 400);
    }
    if (archivo.size > TAMANO_MAXIMO_IMAGEN_BYTES) {
      throw new ApiError("La imagen no puede pesar más de 5MB", 413);
    }
    // No hay backend real que persista el archivo: se crea una URL de blob
    // local para que la previsualización funcione igual que con el upload
    // real. Vive sólo en memoria de esta pestaña — se pierde al recargar.
    const url = URL.createObjectURL(archivo);
    return delay({ url }, 400);
  },

  async createProducto(input: CreateProductoInput) {
    const nombre = input.nombre.trim();
    if (!nombre) throw new ApiError("El nombre del producto es obligatorio", 422);
    const precio = Number(input.precio);
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new ApiError("El precio debe ser un número mayor a cero", 422);
    }
    const categoria = categorias.find((c) => c.id === input.categoriaId);
    if (!categoria) throw new ApiError("La categoría referenciada no existe", 422);
    const producto: Producto = {
      id: uid("p"),
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre,
      nombre,
      precio: money(precio),
      destino: input.destino,
      disponible: input.disponible ?? true,
      activo: true,
      orden: productos.length + 1,
      imagenUrl: input.imagenUrl,
    };
    productos = [...productos, producto];
    return delay(producto);
  },

  async updateProducto(id: string, input: UpdateProductoInput) {
    const idx = productos.findIndex((p) => p.id === id);
    if (idx === -1) throw new ApiError("El producto referenciado no existe", 422);
    const current = productos[idx];
    const next: Producto = { ...current };
    if (input.nombre !== undefined) {
      const trimmed = input.nombre.trim();
      if (!trimmed) throw new ApiError("El nombre del producto es obligatorio", 422);
      next.nombre = trimmed;
    }
    if (input.precio !== undefined) {
      const precio = Number(input.precio);
      if (!Number.isFinite(precio) || precio <= 0) {
        throw new ApiError("El precio debe ser un número mayor a cero", 422);
      }
      next.precio = money(precio);
    }
    if (input.categoriaId !== undefined) {
      const categoria = categorias.find((c) => c.id === input.categoriaId);
      if (!categoria) throw new ApiError("La categoría referenciada no existe", 422);
      next.categoriaId = categoria.id;
      next.categoriaNombre = categoria.nombre;
    }
    if (input.destino !== undefined) next.destino = input.destino;
    if (input.activo !== undefined) next.activo = input.activo;
    if (input.imagenUrl !== undefined) next.imagenUrl = input.imagenUrl;
    productos = [...productos.slice(0, idx), next, ...productos.slice(idx + 1)];
    return delay(next);
  },

  async setProductoDisponibilidad(id: string, disponible: boolean) {
    const idx = productos.findIndex((p) => p.id === id);
    if (idx === -1) throw new ApiError("El producto referenciado no existe", 422);
    const next = { ...productos[idx], disponible };
    productos = [...productos.slice(0, idx), next, ...productos.slice(idx + 1)];
    return delay(next);
  },

  async deleteProducto(id: string) {
    const idx = productos.findIndex((p) => p.id === id);
    if (idx === -1) throw new ApiError("El producto referenciado no existe", 422);
    const next = { ...productos[idx], activo: false };
    productos = [...productos.slice(0, idx), next, ...productos.slice(idx + 1)];
    return delay(undefined);
  },

  // --- Comandas (el PEDIDO) ---------------------------------------------
  async createComanda(input: CreateComandaInput) {
    // La comanda nace YA en la cola, con sus líneas: por eso `items` es
    // obligatorio y con al menos una. Y ya NO hay 409 por mesa ocupada — la
    // mesa acepta N comandas vivas, que es el punto entero del rediseño.
    if (!input.items || input.items.length === 0) {
      throw new ApiError("Una comanda necesita al menos un ítem", 400);
    }
    const tipo = input.tipo ?? "mesa";
    if (tipo === "mesa" && !input.mesaId) {
      throw new ApiError("Una comanda de mesa exige mesaId", 400);
    }
    const mesa = input.mesaId ? mesaById(input.mesaId) : null;

    const items: ComandaItem[] = [];
    for (const entrada of input.items) {
      if (entrada.cantidad <= 0) throw new ApiError("La cantidad debe ser mayor a cero", 422);
      const producto = productoById(entrada.productoId);
      if (!producto.disponible) {
        throw new ApiError(`"${producto.nombre}" no está disponible hoy`, 409);
      }
      items.push(buildItem(producto.id, entrada.cantidad, entrada.nota));
    }

    contadorComanda += 1;
    const comanda: Comanda = {
      id: uid("cmd"),
      tipo,
      mesaId: tipo === "mesa" ? (input.mesaId ?? null) : null,
      mesaEtiqueta: mesa?.etiqueta ?? input.mesaEtiqueta ?? null,
      salonId: mesa ? mesa.salonId : null,
      reservacionId: input.reservacionId ?? null,
      numeroDia: contadorComanda,
      comensales: input.comensales ?? 1,
      meseroId: null,
      estado: "pendiente",
      creadaEn: new Date().toISOString(),
      despachadaEn: null,
      anuladaEn: null,
      cobroId: null,
      total: "0.00",
      notas: input.notas ?? null,
      items,
    };
    recomputeTotals(comanda);

    // Idempotente, igual que el backend: si la comanda viene de una reserva, la
    // deja sentada. La segunda comanda de la misma reserva no cambia nada.
    if (input.reservacionId) {
      reservaciones = reservaciones.map((r) =>
        r.id === input.reservacionId && (r.estado === "pendiente" || r.estado === "confirmada")
          ? { ...r, estado: "sentada" }
          : r,
      );
    }

    comandas = [...comandas, withEstado(comanda)];
    return delay(withEstado(comanda));
  },

  async getComanda(id: string) {
    return delay(comandaById(id));
  },

  async addComandaItems(comandaId: string, items: AddComandaItemInput[]) {
    const current = comandaById(comandaId);
    requerirPendiente(current);
    const created: ComandaItem[] = [];
    for (const item of items) {
      if (item.cantidad <= 0) throw new ApiError("La cantidad debe ser mayor a cero", 422);
      const producto = productoById(item.productoId);
      created.push(buildItem(producto.id, item.cantidad, item.nota));
    }
    const next: Comanda = { ...current, items: [...current.items, ...created] };
    recomputeTotals(next);
    replaceComanda(next);
    return delay(created);
  },

  async removeComandaItem(comandaId: string, itemId: string, motivo: string) {
    const current = comandaById(comandaId);
    requerirPendiente(current);
    const idx = current.items.findIndex((i) => i.id === itemId);
    if (idx === -1) throw new ApiError("El ítem no existe en esta comanda", 404);
    // No se borra: queda la traza, y el ticket reimpreso la muestra.
    const items = [...current.items];
    items[idx] = { ...items[idx], canceladoEn: new Date().toISOString() };
    void motivo; // el motivo se auditaría server-side; el mock sólo lo descarta.
    const next: Comanda = { ...current, items };
    recomputeTotals(next);
    replaceComanda(next);
    return delay(undefined);
  },

  async despacharComanda(comandaId: string) {
    const current = comandaById(comandaId);
    // El predicado completo del backend: lo que hace segura la doble pulsación
    // de dos pantallas de cocina.
    if (current.anuladaEn) throw new ApiError("Esa comanda está anulada", 409);
    if (current.cobroId) throw new ApiError("Esa comanda ya se cobró", 409);
    if (current.despachadaEn) throw new ApiError("Esa comanda ya se despachó", 409);
    // Sale de la cola, NO de la base: sigue viva en la cuenta de la mesa.
    return delay(replaceComanda({ ...current, despachadaEn: new Date().toISOString() }));
  },

  async anularComanda(comandaId: string, motivo: string) {
    const current = comandaById(comandaId);
    if (current.cobroId) {
      throw new ApiError("Esa comanda ya se cobró y no se puede anular", 409);
    }
    if (current.anuladaEn) throw new ApiError("Esa comanda ya estaba anulada", 409);
    void motivo;
    return delay(replaceComanda({ ...current, anuladaEn: new Date().toISOString() }));
  },

  // --- Despacho y cobro --------------------------------------------------
  async getColaDespacho() {
    // Global y FIFO estricto por fecha de creación — sin filtro por mesa ni
    // por destino: cocina y barra miran la misma cola.
    const filas: ComandaEnCola[] = comandas
      .filter((c) => c.despachadaEn == null && c.anuladaEn == null)
      .sort((a, b) => a.creadaEn.localeCompare(b.creadaEn))
      .map((c) => ({
        comandaId: c.id,
        tipo: c.tipo,
        mesaId: c.mesaId,
        mesaEtiqueta: c.mesaEtiqueta ?? null,
        numeroDia: c.numeroDia,
        creadaEn: c.creadaEn,
        minutosEnCola: Math.max(
          0,
          Math.round((Date.now() - new Date(c.creadaEn).getTime()) / 60_000),
        ),
        meseroId: c.meseroId ?? null,
        meseroNombre: null,
        comensales: c.comensales,
        total: c.total,
        notas: c.notas ?? null,
        // Los cancelados VIENEN, marcados: la cocina tiene que ver que algo se
        // anuló si ya lo había empezado.
        items: c.items.map(
          (item): ColaDespachoItem => ({
            id: item.id,
            nombre: item.nombreSnap,
            cantidad: item.cantidad,
            destino: item.destinoSnap,
            nota: item.nota ?? null,
            cancelado: item.canceladoEn != null,
          }),
        ),
      }));
    return delay(filas, 140);
  },

  async getCuentasPorCobrar() {
    const filas = mesas
      .map((mesa) => cuentaDeMesaRow(mesa.id))
      .filter((row): row is CuentaMesa => row !== null && row.comandasPorCobrar > 0)
      .sort((a, b) => a.ocupadaDesde.localeCompare(b.ocupadaDesde));
    return delay(filas);
  },

  async getCuentaDeMesa(mesaId: string) {
    // 200 con `cuenta: null` cuando la mesa está libre: "no debe nada" es una
    // respuesta. El 404 se reserva para una mesa que no existe.
    const mesa = mesaById(mesaId);
    return delay({
      mesa,
      cuenta: cuentaDeMesaRow(mesaId),
      comandas: comandasVivas(mesaId).sort((a, b) => a.creadaEn.localeCompare(b.creadaEn)),
    });
  },

  async cobrarMesa(mesaId: string, input: CobrarMesaInput) {
    mesaById(mesaId);
    const tasa = tasaUsd;
    if (!tasa) {
      // Misma precondición que el backend: el cobro congela la tasa del día.
      throw new ApiError("No hay una tasa de cambio registrada; regístrala antes de cobrar", 400);
    }

    // Sólo lo DESPACHADO y no cobrado. Lo que sigue en cocina nunca entra, se
    // pidan sus ids o no: se queda vivo y arranca la cuenta siguiente.
    let cobrables = comandasVivas(mesaId)
      .filter((c) => c.despachadaEn != null)
      .sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
    if (input.comandaIds) {
      const pedidas = new Set(input.comandaIds);
      const seleccion = cobrables.filter((c) => pedidas.has(c.id));
      if (seleccion.length !== input.comandaIds.length) {
        throw new ApiError(
          "Alguna de las comandas pedidas ya se cobró, sigue en cocina o no es de esa mesa",
          409,
        );
      }
      cobrables = seleccion;
    }
    if (cobrables.length === 0) {
      throw new ApiError(
        "Esa mesa no tiene nada despachado por cobrar (¿ya la cobró otro cajero?)",
        409,
      );
    }

    // Los totales los calcula el servidor desde las comandas, jamás el cliente.
    const subtotal = cobrables.reduce((sum, c) => sum + Number(c.total), 0);
    const descuento = input.descuento ?? 0;
    const propina = input.propina ?? 0;
    const total = subtotal - descuento + propina;
    if (total < 0) throw new ApiError("El descuento no puede superar el subtotal", 400);

    const enUsd = (p: { moneda: string; monto: number }) =>
      p.moneda === "BS" ? p.monto / Number(tasa.valor) : p.monto;
    const recibidoUsd = input.pagos.reduce((sum, p) => sum + enUsd(p), 0);
    if (input.pagos.length === 0 || Math.abs(recibidoUsd - total) > 0.01) {
      throw new ApiError(
        `Los pagos (${money(recibidoUsd)}) no cuadran con el total de la cuenta (${money(total)})`,
        400,
      );
    }
    for (const pago of input.pagos) {
      if ((pago.metodo === "pago_movil" || pago.metodo === "transferencia") && !pago.referencia?.trim()) {
        throw new ApiError("Pago móvil y transferencia exigen número de referencia", 400);
      }
    }

    const ahora = new Date();
    const cobradoEn = ahora.toISOString();
    contadorCobro += 1;
    const cobroId = uid("cob");
    const cubiertas = cobrables.map((c) => withEstado({ ...c, cobroId }));
    for (const comanda of cubiertas) replaceComanda(comanda);

    const cobro: Cobro = {
      id: cobroId,
      mesaId,
      salonId: SALON_ID,
      numeroDia: contadorCobro,
      fechaOperativa: isoDate(ahora),
      turno: turnoDe(ahora.getHours()),
      comensales: Math.max(...cubiertas.map((c) => c.comensales)),
      subtotal: money(subtotal),
      descuento: money(descuento),
      impuesto: "0.00",
      propina: money(propina),
      total: money(total),
      tasaValor: tasa.valor,
      totalBs: money(total * Number(tasa.valor)),
      cobradoEn,
      anuladoEn: null,
      pagos: input.pagos.map((p) => ({
        id: uid("pag"),
        metodo: p.metodo,
        moneda: p.moneda,
        monto: money(p.monto),
        tasaAplicada: p.moneda === "BS" ? tasa.valor : null,
        montoUsd: money(enUsd(p)),
        referencia: p.referencia ?? null,
        recibidoEn: cobradoEn,
      })),
      comandas: cubiertas,
      mesa: mesaById(mesaId),
    };
    cobros = [...cobros, cobro];

    // Cerrar las reservaciones que quedaron servidas: sólo si a la MESA no le
    // queda ninguna comanda viva. Si sigue habiendo algo en cocina, la gente
    // sigue sentada y su cuenta nueva ya arrancó.
    if (comandasVivas(mesaId).length === 0) {
      reservaciones = reservaciones.map((r) =>
        r.mesaId === mesaId && r.estado === "sentada" ? { ...r, estado: "completada" } : r,
      );
    }

    return delay(cobro);
  },

  async getCobro(cobroId: string) {
    const found = cobros.find((c) => c.id === cobroId);
    if (!found) throw new ApiError("Cobro no encontrado", 404);
    return delay(found);
  },

  async listCobrosDelDia(fecha: string) {
    const dia = fecha.slice(0, 10);
    return delay(
      cobros
        .filter((c) => c.fechaOperativa === dia && !c.anuladoEn)
        .sort((a, b) => b.cobradoEn.localeCompare(a.cobradoEn)),
    );
  },

  // --- Tasa de cambio ---------------------------------------------------
  async getTasaVigente() {
    // Real: 200 siempre, nunca null en el objeto raíz.
    return delay({
      fecha: new Date().toISOString().slice(0, 10),
      usd: tasaUsd,
      eur: tasaEur,
    });
  },

  async registrarTasa(valor: number, fuente: FuenteTasa, divisa: DivisaTasa = "USD") {
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new ApiError("La tasa debe ser un número mayor a cero", 422);
    }
    const registrada: TasaDivisa = {
      id: uid(`tasa-${divisa.toLowerCase()}`),
      restauranteId: "restaurante-demo",
      fecha: new Date().toISOString().slice(0, 10),
      divisa,
      valor: valor.toFixed(4),
      fuente,
      registradaPorId: null,
      creadaEn: new Date().toISOString(),
    };
    if (divisa === "USD") tasaUsd = registrada;
    else tasaEur = registrada;
    return delay(registrada);
  },

  async actualizarTasa() {
    // Simula el fetch forzado a dolarapi.com: refresca ambas divisas con un
    // pequeño movimiento aleatorio para que se sienta "en vivo" en el demo.
    const now = new Date().toISOString();
    const fecha = now.slice(0, 10);
    const nextValor = (base: string) => (Number(base) + (Math.random() - 0.5)).toFixed(4);
    tasaUsd = {
      ...(tasaUsd ?? tasaDemo("USD", "40.0000")),
      valor: nextValor(tasaUsd?.valor ?? "40.0000"),
      fuente: "bcv",
      fecha,
      creadaEn: now,
    };
    tasaEur = {
      ...(tasaEur ?? tasaDemo("EUR", "43.5000")),
      valor: nextValor(tasaEur?.valor ?? "43.5000"),
      fuente: "bcv",
      fecha,
      creadaEn: now,
    };
    return delay({ fecha, usd: tasaUsd, eur: tasaEur });
  },

  // --- Reservaciones ------------------------------------------------------
  async listReservaciones() {
    return delay(
      [...reservaciones].sort((a, b) => a.iniciaEn.localeCompare(b.iniciaEn)),
    );
  },

  async createReservacion(input: CreateReservacionInput) {
    if (!input.clienteNombre.trim()) throw new ApiError("El nombre del cliente es obligatorio", 422);
    if (input.personas < 1) throw new ApiError("El número de personas debe ser al menos 1", 422);
    const iniciaEn = new Date(input.iniciaEn);
    const terminaEn = new Date(iniciaEn.getTime() + (input.duracionMin ?? 90) * 60_000);
    if (input.mesaId) {
      const overlap = reservaciones.some(
        (r) =>
          r.mesaId === input.mesaId &&
          (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "sentada") &&
          new Date(r.iniciaEn) < terminaEn &&
          new Date(r.terminaEn) > iniciaEn,
      );
      if (overlap) throw new ApiError("Esa mesa ya está reservada en ese horario", 409);
    }
    const reservacion: Reservacion = {
      id: uid("res"),
      mesaId: input.mesaId ?? null,
      mesaEtiqueta: input.mesaEtiqueta ?? null,
      clienteNombre: input.clienteNombre.trim(),
      clienteTelefono: input.clienteTelefono,
      personas: input.personas,
      iniciaEn: iniciaEn.toISOString(),
      terminaEn: terminaEn.toISOString(),
      estado: "confirmada",
      origen: "personal",
      notas: input.notas,
      codigoPublico: uid("pub"),
      codigoCorto: shortCode(),
    };
    reservaciones = [...reservaciones, reservacion];
    return delay(reservacion);
  },

  async confirmarReservacion(id: string) {
    const idx = reservaciones.findIndex((r) => r.id === id);
    if (idx === -1) throw new ApiError("La reservación no existe", 404);
    const next: Reservacion = { ...reservaciones[idx], estado: "confirmada" };
    reservaciones = [...reservaciones.slice(0, idx), next, ...reservaciones.slice(idx + 1)];
    return delay(next);
  },

  async cancelarReservacion(id: string, motivo: string) {
    const idx = reservaciones.findIndex((r) => r.id === id);
    if (idx === -1) throw new ApiError("La reservación no existe", 404);
    const next: Reservacion = { ...reservaciones[idx], estado: "cancelada", motivoCancelacion: motivo };
    reservaciones = [...reservaciones.slice(0, idx), next, ...reservaciones.slice(idx + 1)];
    return delay(next);
  },

  async sentarReservacion(id: string) {
    const idx = reservaciones.findIndex((r) => r.id === id);
    if (idx === -1) throw new ApiError("La reservación no existe", 404);
    const reservacion = reservaciones[idx];
    if (!reservacion.mesaId || !reservacion.mesaEtiqueta) {
      throw new ApiError("Esta reserva todavía no tiene mesa asignada", 422);
    }
    // ⚠️ Sentar ya NO abre una comanda: una comanda es un pedido y exige al
    // menos una línea. La mesa queda ocupada igual porque `estadoDeMesa`
    // cuenta la reserva sentada como ocupación por sí sola — la misma rama que
    // `v_mesa_estado` agregó con el rediseño.
    const next: Reservacion = { ...reservacion, estado: "sentada" };
    reservaciones = [...reservaciones.slice(0, idx), next, ...reservaciones.slice(idx + 1)];
    return delay(next);
  },

  async buscarReservacionPorCodigo(codigo: string) {
    const normalized = codigo.trim().toUpperCase();
    const found = reservaciones.find(
      (r) =>
        r.codigoPublico.toUpperCase() === normalized ||
        r.codigoCorto.toUpperCase() === normalized ||
        r.codigoCorto.toUpperCase() === `R-${normalized}`,
    );
    return delay(found ?? null);
  },

  async asignarMesaReservacion(codigoPublico: string, mesaId: string, mesaEtiqueta: string) {
    const idx = reservaciones.findIndex((r) => r.codigoPublico === codigoPublico);
    if (idx === -1) throw new ApiError("La reservación no existe", 404);
    const next: Reservacion = { ...reservaciones[idx], mesaId, mesaEtiqueta };
    reservaciones = [...reservaciones.slice(0, idx), next, ...reservaciones.slice(idx + 1)];
    return delay(next);
  },

  // --- Reportes -------------------------------------------------------
  async getReporteDia(fecha: string) {
    const delDia = cobros.filter((c) => c.fechaOperativa === fecha.slice(0, 10) && !c.anuladoEn);
    return delay({
      fecha,
      totalVentasUsd: money(delDia.reduce((sum, c) => sum + Number(c.total), 0)),
      numeroCobros: delDia.length,
      comensales: delDia.reduce((sum, c) => sum + c.comensales, 0),
      propinasUsd: money(delDia.reduce((sum, c) => sum + Number(c.propina), 0)),
    });
  },

  async getReporteProductos(orden: OrdenReporteProducto, limite = 10, fecha?: string) {
    // Igual que `v_producto_vendido_dia`: el día sale del COBRO, no de la
    // comanda, y los ítems cancelados no cuentan (se pidieron, no se vendieron).
    const dia = fecha?.slice(0, 10);
    const byProduct = new Map<string, ProductoVendido>();
    for (const cobro of cobros) {
      if (cobro.anuladoEn) continue;
      if (dia && cobro.fechaOperativa !== dia) continue;
      for (const item of cobro.comandas.flatMap((c) => c.items)) {
        if (item.canceladoEn != null) continue;
        const existing = byProduct.get(item.productoId);
        const ingreso = Number(item.totalLinea);
        if (existing) {
          existing.cantidad += item.cantidad;
          existing.ingresoUsd = money(Number(existing.ingresoUsd) + ingreso);
        } else {
          byProduct.set(item.productoId, {
            productoId: item.productoId,
            nombre: item.nombreSnap,
            cantidad: item.cantidad,
            ingresoUsd: money(ingreso),
          });
        }
      }
    }
    const list = [...byProduct.values()].sort((a, b) =>
      orden === "cantidad" ? b.cantidad - a.cantidad : Number(b.ingresoUsd) - Number(a.ingresoUsd),
    );
    return delay(list.slice(0, limite));
  },

  async getReporteVentas(periodo: PeriodoReporte = "dia", fecha?: string) {
    return delay(buildReporteVentas(periodo, fecha));
  },

  // --- Web Push ---------------------------------------------------------
  async getClaveVapid(): Promise<ClaveVapid> {
    return delay({ clavePublica: VAPID_PUBLICA_DEMO });
  },

  async crearSuscripcionPush(input: SuscripcionPushInput) {
    if (!input.endpoint || !input.p256dh || !input.auth) {
      throw new ApiError("La suscripción push está incompleta", 400);
    }
    const ahora = new Date().toISOString();
    // Upsert por endpoint, igual que el backend real: el latido de cada
    // arranque de la app (ver AppShell) vuelve a mandar la misma suscripción
    // y no debe duplicarla.
    const existente = suscripcionesPush.find((s) => s.endpoint === input.endpoint);
    const fila: SuscripcionPushSeed = {
      id: existente?.id ?? uid("push"),
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      expirationTime: input.expirationTime ?? null,
      temas: input.temas,
      etiqueta: input.etiqueta,
      agenteUsuario: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      creadaEn: existente?.creadaEn ?? ahora,
      renovadaEn: ahora,
    };
    suscripcionesPush = existente
      ? suscripcionesPush.map((s) => (s.id === fila.id ? fila : s))
      : [...suscripcionesPush, fila];
    return delay({
      id: fila.id,
      temas: fila.temas,
      etiqueta: fila.etiqueta ?? null,
      creadaEn: fila.creadaEn,
      renovadaEn: fila.renovadaEn,
    } satisfies SuscripcionPushCreada);
  },

  async listSuscripcionesPush() {
    return delay(suscripcionesPush.map(toSuscripcionPush));
  },

  async actualizarSuscripcionPush(id: string, input: ActualizarSuscripcionPushInput) {
    const idx = suscripcionesPush.findIndex((s) => s.id === id);
    if (idx === -1) throw new ApiError("Esa suscripción no existe", 404);
    const actual = suscripcionesPush[idx];
    const next: SuscripcionPushSeed = {
      ...actual,
      ...(input.temas !== undefined ? { temas: input.temas } : {}),
      ...(input.etiqueta !== undefined ? { etiqueta: input.etiqueta } : {}),
    };
    suscripcionesPush = [
      ...suscripcionesPush.slice(0, idx),
      next,
      ...suscripcionesPush.slice(idx + 1),
    ];
    return delay(undefined);
  },

  async eliminarSuscripcionPush(endpoint: string) {
    // Idempotente a propósito, como el DELETE real (204 aunque no exista):
    // desuscribirse dos veces por lo que sea no debe ser un error.
    suscripcionesPush = suscripcionesPush.filter((s) => s.endpoint !== endpoint);
    return delay(undefined);
  },
};
