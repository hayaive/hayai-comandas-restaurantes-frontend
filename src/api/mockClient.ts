import type {
  AddComandaItemInput,
  ApiClient,
  Categoria,
  Comanda,
  ComandaItem,
  CobrarComandaInput,
  CreateComandaInput,
  CreatePlantillaInput,
  CreatePlantillaMesaInput,
  CreateProductoInput,
  CreateReservacionInput,
  EstadoComandaItem,
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
  TasaDivisa,
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

// --- Mock de `GET /reportes/ventas` -------------------------------------
// El mock sólo tiene datos fabricados para "hoy" (`comandasCobradasHoy`), así
// que cualquier otro día operativo del tramo pedido viene en cero — es lo que
// una `serie` "densa" real haría de todos modos si ese día no tuvo ventas.

const ZERO_RESUMEN: VentaResumen = {
  comandas: 0,
  comensales: 0,
  totalUsd: "0.00",
  ventasUsd: "0.00",
  propinasUsd: "0.00",
  descuentosUsd: "0.00",
  impuestosUsd: "0.00",
  ticketPromedioUsd: "0.0000",
};

function sumResumen(comandas: Comanda[]): VentaResumen {
  const total = comandas.length;
  const comensales = comandas.reduce((sum, c) => sum + c.comensales, 0);
  const ventasUsd = comandas.reduce((sum, c) => sum + Number(c.subtotal), 0);
  const propinasUsd = comandas.reduce((sum, c) => sum + Number(c.propina ?? 0), 0);
  const totalUsd = ventasUsd + propinasUsd;
  return {
    comandas: total,
    comensales,
    totalUsd: money(totalUsd),
    ventasUsd: money(ventasUsd),
    propinasUsd: money(propinasUsd),
    descuentosUsd: "0.00",
    impuestosUsd: "0.00",
    ticketPromedioUsd: total === 0 ? "0.0000" : (totalUsd / total).toFixed(4),
  };
}

/** Suma varios `VentaResumen` (p. ej. una `serie`) en uno solo. */
function reduceResumenes(resumenes: VentaResumen[]): VentaResumen {
  const comandas = resumenes.reduce((sum, r) => sum + r.comandas, 0);
  const comensales = resumenes.reduce((sum, r) => sum + r.comensales, 0);
  const sumField = (key: keyof Omit<VentaResumen, "comandas" | "comensales" | "ticketPromedioUsd">) =>
    resumenes.reduce((sum, r) => sum + Number(r[key]), 0);
  const totalUsd = sumField("totalUsd");
  return {
    comandas,
    comensales,
    totalUsd: money(totalUsd),
    ventasUsd: money(sumField("ventasUsd")),
    propinasUsd: money(sumField("propinasUsd")),
    descuentosUsd: money(sumField("descuentosUsd")),
    impuestosUsd: money(sumField("impuestosUsd")),
    ticketPromedioUsd: comandas === 0 ? "0.0000" : (totalUsd / comandas).toFixed(4),
  };
}

/** Escala un resumen por un factor (para fabricar una comparación creíble). */
function scaleResumen(base: VentaResumen, factor: number): VentaResumen {
  if (base.comandas === 0) return ZERO_RESUMEN;
  const comandas = Math.max(1, Math.round(base.comandas * factor));
  const totalUsd = Number(base.totalUsd) * factor;
  return {
    comandas,
    comensales: Math.max(1, Math.round(base.comensales * factor)),
    totalUsd: money(totalUsd),
    ventasUsd: money(Number(base.ventasUsd) * factor),
    propinasUsd: money(Number(base.propinasUsd) * factor),
    descuentosUsd: money(Number(base.descuentosUsd) * factor),
    impuestosUsd: money(Number(base.impuestosUsd) * factor),
    ticketPromedioUsd: (totalUsd / comandas).toFixed(4),
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

function turnoDe(hour: number): VentaPunto["clave"] {
  if (hour >= 5 && hour < 11) return "desayuno";
  if (hour >= 11 && hour < 17) return "almuerzo";
  if (hour >= 17 && hour < 23) return "cena";
  return "madrugada";
}

/**
 * Reporte de ventas por período fabricado a partir de `comandasCobradasHoy` —
 * el mock no tiene histórico real, así que sólo el día operativo actual trae
 * datos y el resto del tramo (días/meses anteriores) queda en cero. Suficiente
 * para probar la UI (selector, comparación, serie) sin backend real corriendo.
 */
function buildReporteVentas(periodo: PeriodoReporte, fechaInput: string | undefined): ReporteVentas {
  const now = new Date();
  const hoy = isoDate(now);
  const ancla = fechaInput ?? hoy;
  const esHoyElAncla = ancla === hoy;

  if (periodo === "dia") {
    const totalHoy = sumResumen(comandasCobradasHoy);
    const turnos: VentaPunto["clave"][] = ["desayuno", "almuerzo", "cena", "madrugada"];
    const porTurno = new Map<string, Comanda[]>(turnos.map((t) => [t, []]));
    if (esHoyElAncla) {
      for (const comanda of comandasCobradasHoy) {
        const hour = new Date(comanda.cerradaEn ?? comanda.abiertaEn).getHours();
        porTurno.get(turnoDe(hour))?.push(comanda);
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
      serie.push({ clave, ...(esHoyBucket ? sumResumen(comandasCobradasHoy) : ZERO_RESUMEN) });
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
      ...(esMesBucket ? sumResumen(comandasCobradasHoy) : ZERO_RESUMEN),
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

function recomputeTotals(comanda: Comanda): void {
  const activeItems = comanda.items.filter((item) => item.estado !== "cancelado");
  const subtotal = activeItems.reduce((sum, item) => sum + Number(item.totalLinea), 0);
  comanda.subtotal = money(subtotal);
  comanda.total = money(subtotal);
}

// ---------------------------------------------------------------------------
// Seed: comandas activas — matches the occupied tables already seeded in
// src/lib/mockData.ts (Salón principal: t1, t5, t7, t11, t16).
// ---------------------------------------------------------------------------

function buildItem(productoId: string, cantidad: number, estado: EstadoComandaItem): ComandaItem {
  const producto = productoById(productoId);
  return {
    id: uid("ci"),
    productoId,
    nombreSnap: producto.nombre,
    precioUnitarioSnap: producto.precio,
    cantidad,
    totalLinea: money(Number(producto.precio) * cantidad),
    estado,
  };
}

let comandas: Comanda[] = [
  {
    id: "cmd-t1",
    mesaId: "t1",
    mesaEtiqueta: "M-1",
    clienteNombre: "Marisol Peña",
    comensales: 2,
    estado: "abierta",
    abiertaEn: todayAt(19, 5),
    items: [buildItem("p-2", 2, "servido"), buildItem("p-4", 2, "en_preparacion"), buildItem("p-9", 2, "servido")],
    subtotal: "0.00",
    total: "0.00",
  },
  {
    id: "cmd-t5",
    mesaId: "t5",
    mesaEtiqueta: "M-5",
    clienteNombre: "Grupo Herrera",
    comensales: 4,
    estado: "abierta",
    abiertaEn: todayAt(19, 30),
    items: [buildItem("p-1", 1, "servido"), buildItem("p-5", 3, "pendiente"), buildItem("p-10", 4, "servido")],
    subtotal: "0.00",
    total: "0.00",
  },
  {
    id: "cmd-t7",
    mesaId: "t7",
    mesaEtiqueta: "M-7",
    clienteNombre: "Mateo Londoño",
    comensales: 6,
    estado: "por_cobrar",
    abiertaEn: todayAt(18, 40),
    items: [
      buildItem("p-3", 2, "servido"),
      buildItem("p-4", 3, "servido"),
      buildItem("p-6", 3, "servido"),
      buildItem("p-11", 6, "servido"),
    ],
    subtotal: "0.00",
    total: "0.00",
  },
  {
    id: "cmd-t11",
    mesaId: "t11",
    mesaEtiqueta: "M-11",
    clienteNombre: "Camila Duarte",
    comensales: 2,
    estado: "abierta",
    abiertaEn: todayAt(20, 0),
    items: [buildItem("p-8", 2, "pendiente")],
    subtotal: "0.00",
    total: "0.00",
  },
  {
    id: "cmd-t16",
    mesaId: "t16",
    mesaEtiqueta: "M-16",
    clienteNombre: "Valeria Ocampo",
    comensales: 4,
    estado: "abierta",
    abiertaEn: todayAt(19, 50),
    items: [buildItem("p-7", 2, "en_preparacion"), buildItem("p-9", 3, "servido")],
    subtotal: "0.00",
    total: "0.00",
  },
];
comandas.forEach(recomputeTotals);

// Closed comandas earlier today, feeding the sales report so it is not empty
// on first load. Never surfaced directly, only aggregated.
let comandasCobradasHoy: Comanda[] = [
  { id: "cmd-h1", mesaId: "t2", mesaEtiqueta: "M-2", comensales: 2, estado: "cobrada", abiertaEn: todayAt(12, 15), cerradaEn: todayAt(13, 20), items: [buildItem("p-4", 2, "servido"), buildItem("p-9", 2, "servido")], subtotal: "0", total: "0" },
  { id: "cmd-h2", mesaId: "t4", mesaEtiqueta: "M-4", comensales: 4, estado: "cobrada", abiertaEn: todayAt(12, 40), cerradaEn: todayAt(14, 5), items: [buildItem("p-4", 4, "servido"), buildItem("p-10", 4, "servido"), buildItem("p-11", 2, "servido")], subtotal: "0", total: "0" },
  { id: "cmd-h3", mesaId: "t9", mesaEtiqueta: "M-9", comensales: 6, estado: "cobrada", abiertaEn: todayAt(13, 0), cerradaEn: todayAt(14, 30), items: [buildItem("p-1", 2, "servido"), buildItem("p-5", 6, "servido"), buildItem("p-9", 6, "servido")], subtotal: "0", total: "0" },
  { id: "cmd-h4", mesaId: "t12", mesaEtiqueta: "M-12", comensales: 2, estado: "cobrada", abiertaEn: todayAt(18, 0), cerradaEn: todayAt(19, 0), items: [buildItem("p-2", 2, "servido"), buildItem("p-4", 2, "servido")], subtotal: "0", total: "0" },
  { id: "cmd-h5", mesaId: "t13", mesaEtiqueta: "M-13", comensales: 2, estado: "cobrada", abiertaEn: todayAt(18, 20), cerradaEn: todayAt(19, 15), items: [buildItem("p-3", 1, "servido"), buildItem("p-7", 2, "servido"), buildItem("p-10", 2, "servido")], subtotal: "0", total: "0" },
];
comandasCobradasHoy.forEach(recomputeTotals);
// Los pagos se arman después de recalcular totales: la suma tiene que cuadrar
// con el total, igual que exige el backend (vista `v_comanda_descuadre`).
comandasCobradasHoy = comandasCobradasHoy.map((comanda, index) => ({
  ...comanda,
  numeroDia: index + 1,
  propina: "0.00",
  pagos: [
    {
      id: uid("pag"),
      metodo: index % 2 === 0 ? ("efectivo_usd" as const) : ("pago_movil" as const),
      moneda: "USD" as const,
      monto: comanda.total,
      montoUsd: comanda.total,
      referencia: index % 2 === 0 ? undefined : `00${index}45678`,
      recibidoEn: comanda.cerradaEn ?? comanda.abiertaEn,
    },
  ],
}));

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

/** Misma regla que la vista `v_mesa_estado` del backend, en memoria. */
function estadoDeMesa(mesaId: string, bloqueada: boolean): EstadoMesa {
  if (bloqueada) return "bloqueada";
  const ocupada = comandas.some(
    (c) => c.mesaId === mesaId && (c.estado === "abierta" || c.estado === "por_cobrar"),
  );
  if (ocupada) return "ocupada";
  const reservada = reservaciones.some(
    (r) =>
      r.mesaId === mesaId &&
      (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "sentada"),
  );
  return reservada ? "reservada" : "libre";
}

function clienteDeMesa(mesaId: string): string | null {
  const comanda = comandas.find(
    (c) => c.mesaId === mesaId && (c.estado === "abierta" || c.estado === "por_cobrar"),
  );
  if (comanda?.clienteNombre) return comanda.clienteNombre;
  const reserva = reservaciones.find(
    (r) =>
      r.mesaId === mesaId &&
      (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "sentada"),
  );
  return reserva?.clienteNombre ?? null;
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
        const comanda = comandas.find(
          (c) => c.mesaId === mesa.id && (c.estado === "abierta" || c.estado === "por_cobrar"),
        );
        const reserva = reservaciones.find(
          (r) =>
            r.mesaId === mesa.id &&
            (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "sentada"),
        );
        rows.push({
          salonId,
          plantillaId: plantilla.id,
          plantillaActiva: plantilla.activa,
          mesaId: mesa.id,
          etiqueta: mesa.etiqueta,
          estado,
          bloqueada: pm.bloqueada,
          comandaId: comanda?.id ?? null,
          reservacionId: reserva?.id ?? null,
          reservacionCliente: clienteDeMesa(mesa.id),
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

  // --- Comandas ---------------------------------------------------------
  async listComandasActivas() {
    return delay(comandas.filter((c) => c.estado === "abierta" || c.estado === "por_cobrar"));
  },

  async createComanda(input: CreateComandaInput) {
    const existing = comandas.find(
      (c) => c.mesaId === input.mesaId && (c.estado === "abierta" || c.estado === "por_cobrar"),
    );
    if (existing) throw new ApiError("La mesa ya tiene una comanda abierta", 409);
    const comanda: Comanda = {
      id: uid("cmd"),
      mesaId: input.mesaId,
      mesaEtiqueta: input.mesaEtiqueta,
      reservacionId: input.reservacionId,
      clienteNombre: input.clienteNombre,
      comensales: input.comensales ?? 1,
      estado: "abierta",
      abiertaEn: new Date().toISOString(),
      items: [],
      subtotal: "0.00",
      total: "0.00",
    };
    comandas = [...comandas, comanda];
    return delay(comanda);
  },

  async getComanda(id: string) {
    const found = comandas.find((c) => c.id === id);
    if (!found) throw new ApiError("La comanda no existe", 404);
    return delay(found);
  },

  async addComandaItems(comandaId: string, items: AddComandaItemInput[]) {
    const idx = comandas.findIndex((c) => c.id === comandaId);
    if (idx === -1) throw new ApiError("La comanda no existe", 404);
    const comanda = { ...comandas[idx], items: [...comandas[idx].items] };
    const created: ComandaItem[] = [];
    for (const item of items) {
      if (item.cantidad <= 0) throw new ApiError("La cantidad debe ser mayor a cero", 422);
      const producto = productoById(item.productoId);
      const line = buildItem(producto.id, item.cantidad, "pendiente");
      line.nota = item.nota;
      comanda.items.push(line);
      created.push(line);
    }
    recomputeTotals(comanda);
    comandas = [...comandas.slice(0, idx), comanda, ...comandas.slice(idx + 1)];
    return delay(created);
  },

  async setComandaItemEstado(comandaId: string, itemId: string, estado: EstadoComandaItem) {
    const cIdx = comandas.findIndex((c) => c.id === comandaId);
    if (cIdx === -1) throw new ApiError("La comanda no existe", 404);
    const comanda = { ...comandas[cIdx], items: [...comandas[cIdx].items] };
    const iIdx = comanda.items.findIndex((i) => i.id === itemId);
    if (iIdx === -1) throw new ApiError("El ítem no existe en esta comanda", 404);
    const updated: ComandaItem = { ...comanda.items[iIdx], estado };
    comanda.items[iIdx] = updated;
    recomputeTotals(comanda);
    comandas = [...comandas.slice(0, cIdx), comanda, ...comandas.slice(cIdx + 1)];
    return delay(updated);
  },

  async removeComandaItem(comandaId: string, itemId: string, motivo: string) {
    void motivo; // el motivo de cancelación se auditaría server-side; el mock solo lo descarta.
    const cIdx = comandas.findIndex((c) => c.id === comandaId);
    if (cIdx === -1) throw new ApiError("La comanda no existe", 404);
    const comanda = { ...comandas[cIdx], items: [...comandas[cIdx].items] };
    const iIdx = comanda.items.findIndex((i) => i.id === itemId);
    if (iIdx === -1) throw new ApiError("El ítem no existe en esta comanda", 404);
    comanda.items[iIdx] = { ...comanda.items[iIdx], estado: "cancelado" };
    recomputeTotals(comanda);
    comandas = [...comandas.slice(0, cIdx), comanda, ...comandas.slice(cIdx + 1)];
    return delay(undefined);
  },

  async cobrarComanda(comandaId: string, input: CobrarComandaInput) {
    const idx = comandas.findIndex((c) => c.id === comandaId);
    if (idx === -1) throw new ApiError("La comanda no existe", 404);
    const tasa = tasaUsd;
    if (!tasa) {
      // Misma precondición que el backend real: cobrar congela la tasa del día,
      // así que sin tasa registrada no se puede cerrar una comanda.
      throw new ApiError("No hay una tasa de cambio registrada; regístrala antes de cobrar", 400);
    }
    const current = comandas[idx];
    const aCobrar = Number(current.total) + (input.propina ?? 0) - (input.descuento ?? 0);
    const recibidoUsd = input.pagos.reduce(
      (sum, p) => sum + (p.moneda === "BS" ? p.monto / Number(tasa.valor) : p.monto),
      0,
    );
    if (input.pagos.length === 0 || Math.abs(recibidoUsd - aCobrar) > 0.009) {
      throw new ApiError(
        `Los pagos (${money(recibidoUsd)}) no cuadran con el total a cobrar (${money(aCobrar)})`,
        422,
      );
    }
    const comanda: Comanda = {
      ...current,
      estado: "cobrada",
      cerradaEn: new Date().toISOString(),
      propina: money(input.propina ?? 0),
      total: money(aCobrar),
      pagos: input.pagos.map((p) => ({
        id: uid("pag"),
        metodo: p.metodo,
        moneda: p.moneda,
        monto: money(p.monto),
        montoUsd: money(p.moneda === "BS" ? p.monto / Number(tasa.valor) : p.monto),
        referencia: p.referencia,
        recibidoEn: new Date().toISOString(),
      })),
    };
    comandas = comandas.filter((c) => c.id !== comandaId);
    comandasCobradasHoy = [...comandasCobradasHoy, comanda];
    return delay(comanda);
  },

  async listComandasCobradas(fecha: string) {
    const dia = fecha.slice(0, 10);
    return delay(
      comandasCobradasHoy
        .filter((c) => (c.cerradaEn ?? c.abiertaEn).slice(0, 10) === dia)
        .sort((a, b) => (b.cerradaEn ?? b.abiertaEn).localeCompare(a.cerradaEn ?? a.abiertaEn)),
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

  async anularComanda(comandaId: string, motivo: string) {
    const idx = comandas.findIndex((c) => c.id === comandaId);
    if (idx === -1) throw new ApiError("La comanda no existe", 404);
    const comanda: Comanda = { ...comandas[idx], estado: "anulada" };
    void motivo;
    comandas = comandas.filter((c) => c.id !== comandaId);
    return delay(comanda);
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
    const next: Reservacion = { ...reservacion, estado: "sentada" };
    reservaciones = [...reservaciones.slice(0, idx), next, ...reservaciones.slice(idx + 1)];

    const comanda: Comanda = {
      id: uid("cmd"),
      mesaId: reservacion.mesaId,
      mesaEtiqueta: reservacion.mesaEtiqueta,
      reservacionId: reservacion.id,
      clienteNombre: reservacion.clienteNombre,
      comensales: reservacion.personas,
      estado: "abierta",
      abiertaEn: new Date().toISOString(),
      items: [],
      subtotal: "0.00",
      total: "0.00",
    };
    comandas = [...comandas, comanda];
    return delay({ reservacion: next, comanda });
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
    const totalVentasUsd = money(
      comandasCobradasHoy.reduce((sum, c) => sum + Number(c.total), 0),
    );
    return delay({
      fecha,
      totalVentasUsd,
      numeroComandas: comandasCobradasHoy.length,
      comensales: comandasCobradasHoy.reduce((sum, c) => sum + c.comensales, 0),
      propinasUsd: money(comandasCobradasHoy.reduce((sum, c) => sum + Number(c.propina ?? 0), 0)),
    });
  },

  async getReporteProductos(orden: OrdenReporteProducto, limite = 10, fecha?: string) {
    const dia = fecha?.slice(0, 10);
    const byProduct = new Map<string, ProductoVendido>();
    for (const comanda of comandasCobradasHoy) {
      if (dia && (comanda.cerradaEn ?? comanda.abiertaEn).slice(0, 10) !== dia) continue;
      for (const item of comanda.items) {
        if (item.estado === "cancelado") continue;
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
};
