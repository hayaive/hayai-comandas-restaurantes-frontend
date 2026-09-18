import type {
  AccesoCreadoResult,
  AccesoTemporal,
  AccesoVencimientos,
  ActivarPlantillaResult,
  ActualizarSuscripcionPushInput,
  AddComandaItemInput,
  ApiClient,
  CanjearAccesoInput,
  CanjearAccesoResult,
  Categoria,
  ClaveVapid,
  ResultadoPruebaPush,
  Cobro,
  CobrarMesaInput,
  ColaDespachoItem,
  Comanda,
  ComandaEnCola,
  ComandaItem,
  ConsultarAccesoInput,
  ConsultarAccesoResult,
  CreateAccesoInput,
  CuentaDeMesa,
  CuentaMesa,
  CreateComandaInput,
  CreatePlantillaInput,
  CreatePlantillaMesaInput,
  CreateProductoInput,
  CreateReservacionInput,
  DestinoPreparacion,
  EstadoMesa,
  FuenteTasa,
  Mesa,
  MesaEstado,
  OrdenReporteProducto,
  PeriodoReporte,
  Plantilla,
  PlantillaDetalle,
  PlantillaMesa,
  Producto,
  ProductoVendido,
  RegenerarAccesoInput,
  RegenerarAccesoResult,
  ReporteDia,
  ReporteVentas,
  Reservacion,
  Restaurante,
  Salon,
  DivisaTasa,
  SuscripcionPush,
  SuscripcionPushCreada,
  SuscripcionPushInput,
  TasaDivisa,
  TasaVigente,
  TipoComanda,
  UpdateAccesoInput,
  UpdateMesaInput,
  UpdatePlantillaInput,
  UpdatePlantillaMesaInput,
  UpdateProductoInput,
  UpdateRestauranteInput,
  UploadImagenResult,
} from "./types";
import { ApiError } from "./types";
import { getToken, handleUnauthorized } from "./auth";

/**
 * Real HTTP implementation, calling the NestJS backend per `CONTRACT.md`
 * (prefix `/api/v1`). Selected automatically by `src/api/index.ts` once
 * `VITE_API_URL` is set — no screen or store needs to change.
 */

function baseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (!configured) {
    throw new ApiError(
      "VITE_API_URL no está configurada; no se puede llamar al backend real.",
      500,
    );
  }
  return configured.replace(/\/+$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  // `FormData` bodies (file uploads) must NOT get a manual `Content-Type`:
  // the browser sets `multipart/form-data; boundary=...` itself, and
  // overriding it here would drop the boundary and break the upload.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }

  if (response.status === 401) {
    // Token missing/expired/invalid: clear the stale session so the router
    // guard sends the user back to /login instead of leaving the screen in a
    // broken, half-loaded state.
    handleUnauthorized();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(extractMessage(body, response.status), response.status);
  }

  return body as T;
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const raw = (body as { message: unknown }).message;
    if (typeof raw === "string") return raw;
  }
  return `Error ${status}`;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function json(body: unknown): RequestInit {
  return { body: JSON.stringify(body) };
}

/**
 * OJO — los endpoints que leen una VISTA SQL no respetan el camelCase del
 * contrato: `GET /plano`, `GET /despacho/cola`, `GET /cuentas-por-cobrar` y el
 * campo `cuenta` de `GET /mesas/:id/cuenta` devuelven las filas crudas
 * (`v_mesa_estado`, `v_cola_despacho`, `v_cuenta_mesa`), o sea snake_case. Lo
 * que pasa por Prisma (`/comandas`, `/cobros`, y los campos `mesa`/`comandas`
 * de la cuenta) sí viene en camelCase. Todo se normaliza aquí, en el borde,
 * para que ni los stores ni las pantallas tengan que saberlo.
 *
 * Los `Decimal` de una vista pueden llegar como `string` o como `number` según
 * cómo serialice la fila: cada helper lo normaliza en vez de asumir uno.
 */
function decimalString(value: string | number | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
}

function intOf(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

interface MesaEstadoRow {
  salon_id: string;
  plantilla_id: string;
  plantilla_activa: boolean;
  mesa_id: string;
  etiqueta: string;
  estado: EstadoMesa;
  bloqueada: boolean;
  comandas: number | string;
  comandas_en_cocina: number | string;
  comandas_por_cobrar: number | string;
  cuenta_total: string | number;
  ocupada_desde: string | null;
  comensales: number | string;
  reservacion_id: string | null;
  reservacion_cliente: string | null;
  sentada_reservacion_id: string | null;
  sentada_cliente: string | null;
  sentada_en: string | null;
}

function toMesaEstado(row: MesaEstadoRow): MesaEstado {
  return {
    salonId: row.salon_id,
    plantillaId: row.plantilla_id,
    plantillaActiva: row.plantilla_activa,
    mesaId: row.mesa_id,
    etiqueta: row.etiqueta,
    estado: row.estado,
    bloqueada: row.bloqueada,
    comandas: intOf(row.comandas),
    comandasEnCocina: intOf(row.comandas_en_cocina),
    comandasPorCobrar: intOf(row.comandas_por_cobrar),
    cuentaTotal: decimalString(row.cuenta_total),
    ocupadaDesde: row.ocupada_desde,
    comensales: intOf(row.comensales),
    reservacionId: row.reservacion_id,
    reservacionCliente: row.reservacion_cliente,
    sentadaReservacionId: row.sentada_reservacion_id,
    sentadaCliente: row.sentada_cliente,
    sentadaEn: row.sentada_en,
  };
}

/** Fila cruda de `v_cola_despacho`, con las líneas embebidas en jsonb. */
interface ColaDespachoRow {
  comanda_id: string;
  tipo: TipoComanda;
  mesa_id: string | null;
  mesa_etiqueta: string | null;
  numero_dia: number | string;
  creada_en: string;
  minutos_en_cola: number | string;
  mesero_id: string | null;
  mesero_nombre: string | null;
  comensales: number | string;
  total: string | number;
  notas: string | null;
  items: RawColaItem[] | null;
}

interface RawColaItem {
  id: string;
  nombre: string;
  cantidad: string | number;
  destino: DestinoPreparacion;
  nota?: string | null;
  cancelado: boolean;
}

function toComandaEnCola(row: ColaDespachoRow): ComandaEnCola {
  return {
    comandaId: row.comanda_id,
    tipo: row.tipo,
    mesaId: row.mesa_id,
    mesaEtiqueta: row.mesa_etiqueta,
    numeroDia: intOf(row.numero_dia),
    creadaEn: row.creada_en,
    minutosEnCola: intOf(row.minutos_en_cola),
    meseroId: row.mesero_id,
    meseroNombre: row.mesero_nombre,
    comensales: intOf(row.comensales),
    total: decimalString(row.total),
    notas: row.notas,
    // `jsonb_agg` devuelve NULL, no `[]`, cuando la comanda no tiene líneas.
    items: (row.items ?? []).map(
      (item): ColaDespachoItem => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: Number(item.cantidad),
        destino: item.destino,
        nota: item.nota ?? null,
        cancelado: Boolean(item.cancelado),
      }),
    ),
  };
}

/** Fila cruda de `v_cuenta_mesa`. */
interface CuentaMesaRow {
  mesa_id: string;
  mesa_etiqueta: string;
  salon_id: string | null;
  salon_nombre: string | null;
  comandas: number | string;
  comandas_por_cobrar: number | string;
  comandas_en_cocina: number | string;
  cuenta_total: string | number;
  total_por_cobrar: string | number;
  total_en_cocina: string | number;
  comensales: number | string;
  ocupada_desde: string;
  minutos_ocupada: number | string;
  mesero_id: string | null;
  reservacion_id: string | null;
}

function toCuentaMesa(row: CuentaMesaRow): CuentaMesa {
  return {
    mesaId: row.mesa_id,
    mesaEtiqueta: row.mesa_etiqueta,
    salonId: row.salon_id,
    salonNombre: row.salon_nombre,
    comandas: intOf(row.comandas),
    comandasPorCobrar: intOf(row.comandas_por_cobrar),
    comandasEnCocina: intOf(row.comandas_en_cocina),
    cuentaTotal: decimalString(row.cuenta_total),
    totalPorCobrar: decimalString(row.total_por_cobrar),
    totalEnCocina: decimalString(row.total_en_cocina),
    comensales: intOf(row.comensales),
    ocupadaDesde: row.ocupada_desde,
    minutosOcupada: intOf(row.minutos_ocupada),
    meseroId: row.mesero_id,
    reservacionId: row.reservacion_id,
  };
}

/** Lo que Prisma serializa de `comanda` + `items`, ya en camelCase. */
interface ComandaResponse {
  id: string;
  tipo: TipoComanda;
  mesaId: string | null;
  salonId?: string | null;
  reservacionId?: string | null;
  numeroDia: number;
  comensales: number;
  meseroId?: string | null;
  estado: Comanda["estado"];
  creadaEn: string;
  despachadaEn?: string | null;
  anuladaEn?: string | null;
  cobroId?: string | null;
  total: string | number;
  notas?: string | null;
  items?: RawComandaItem[];
  mesa?: { etiqueta: string } | null;
}

interface RawComandaItem {
  id: string;
  productoId: string;
  nombreSnap: string;
  precioUnitarioSnap: string | number;
  destinoSnap: DestinoPreparacion;
  /** Prisma serializa el Decimal como string; el resto de la app lo usa como number. */
  cantidad: string | number;
  totalLinea: string | number;
  nota?: string | null;
  canceladoEn?: string | null;
}

function toComandaItem(raw: RawComandaItem): ComandaItem {
  return {
    id: raw.id,
    productoId: raw.productoId,
    nombreSnap: raw.nombreSnap,
    precioUnitarioSnap: decimalString(raw.precioUnitarioSnap),
    destinoSnap: raw.destinoSnap,
    cantidad: Number(raw.cantidad),
    totalLinea: decimalString(raw.totalLinea),
    nota: raw.nota ?? null,
    canceladoEn: raw.canceladoEn ?? null,
  };
}

function toComanda(raw: ComandaResponse, mesaEtiquetaFallback?: string): Comanda {
  return {
    id: raw.id,
    tipo: raw.tipo,
    mesaId: raw.mesaId ?? null,
    mesaEtiqueta: raw.mesa?.etiqueta ?? mesaEtiquetaFallback ?? null,
    salonId: raw.salonId ?? null,
    reservacionId: raw.reservacionId ?? null,
    numeroDia: raw.numeroDia,
    comensales: raw.comensales,
    meseroId: raw.meseroId ?? null,
    estado: raw.estado,
    creadaEn: raw.creadaEn,
    despachadaEn: raw.despachadaEn ?? null,
    anuladaEn: raw.anuladaEn ?? null,
    cobroId: raw.cobroId ?? null,
    total: decimalString(raw.total),
    notas: raw.notas ?? null,
    items: (raw.items ?? []).map(toComandaItem),
  };
}

interface CobroResponse {
  id: string;
  mesaId: string | null;
  salonId: string | null;
  numeroDia: number;
  fechaOperativa: string;
  turno: Cobro["turno"];
  comensales: number;
  subtotal: string | number;
  descuento: string | number;
  impuesto: string | number;
  propina: string | number;
  total: string | number;
  tasaValor: string | number;
  totalBs: string | number;
  cobradoEn: string;
  anuladoEn?: string | null;
  motivoAnulacion?: string | null;
  notas?: string | null;
  pagos?: {
    id: string;
    metodo: Cobro["pagos"][number]["metodo"];
    moneda: Cobro["pagos"][number]["moneda"];
    monto: string | number;
    tasaAplicada?: string | number | null;
    montoUsd: string | number;
    referencia?: string | null;
    recibidoEn: string;
  }[];
  comandas?: ComandaResponse[];
  mesa?: Mesa | null;
}

function toCobro(raw: CobroResponse): Cobro {
  const mesaEtiqueta = raw.mesa?.etiqueta;
  return {
    id: raw.id,
    mesaId: raw.mesaId,
    salonId: raw.salonId,
    numeroDia: raw.numeroDia,
    fechaOperativa: raw.fechaOperativa,
    turno: raw.turno,
    comensales: raw.comensales,
    subtotal: decimalString(raw.subtotal),
    descuento: decimalString(raw.descuento),
    impuesto: decimalString(raw.impuesto),
    propina: decimalString(raw.propina),
    total: decimalString(raw.total),
    tasaValor: decimalString(raw.tasaValor),
    totalBs: decimalString(raw.totalBs),
    cobradoEn: raw.cobradoEn,
    anuladoEn: raw.anuladoEn ?? null,
    motivoAnulacion: raw.motivoAnulacion ?? null,
    notas: raw.notas ?? null,
    pagos: (raw.pagos ?? []).map((pago) => ({
      id: pago.id,
      metodo: pago.metodo,
      moneda: pago.moneda,
      monto: decimalString(pago.monto),
      tasaAplicada: pago.tasaAplicada == null ? null : decimalString(pago.tasaAplicada),
      montoUsd: decimalString(pago.montoUsd),
      referencia: pago.referencia ?? null,
      recibidoEn: pago.recibidoEn,
    })),
    comandas: (raw.comandas ?? []).map((comanda) => toComanda(comanda, mesaEtiqueta)),
    mesa: raw.mesa ?? null,
  };
}

interface VentaDiaRow {
  /** Renombrada desde `comandas` con el rediseño: hoy cuenta FACTURAS. */
  cobros?: number | string;
  comensales?: number | string;
  total_usd?: string;
  ventas_usd?: string;
  propinas_usd?: string;
}

function toReporteDia(fecha: string, row: VentaDiaRow | null): ReporteDia {
  return {
    fecha,
    totalVentasUsd: row?.total_usd ?? row?.ventas_usd ?? "0",
    numeroCobros: intOf(row?.cobros),
    comensales: intOf(row?.comensales),
    propinasUsd: row?.propinas_usd ?? "0",
  };
}

/**
 * Fila de `v_producto_vendido_dia`. El nombre del producto viene en
 * `producto_nombre`, no en `nombre` — verificado contra el backend real. Se
 * aceptan las dos grafías por si el backend llega a normalizar a camelCase.
 */
interface ProductoVendidoRow {
  producto_id?: string;
  productoId?: string;
  producto_nombre?: string;
  nombre?: string;
  cantidad: string | number;
  ingreso_usd?: string;
  ingresoUsd?: string;
}

function toProductoVendido(row: ProductoVendidoRow): ProductoVendido {
  const nombre = row.producto_nombre ?? row.nombre ?? "Producto sin nombre";
  return {
    productoId: row.producto_id ?? row.productoId ?? nombre,
    nombre,
    cantidad: Number(row.cantidad),
    ingresoUsd: row.ingreso_usd ?? row.ingresoUsd ?? "0",
  };
}

/**
 * El backend tampoco denormaliza `mesaEtiqueta` en las reservaciones (sólo
 * manda `mesaId`), igual que pasaba con `categoriaNombre` en `/productos`.
 * Se deja en `null` aquí y `useReservationStore` lo completa con la etiqueta
 * real de la mesa que ya tiene cargada el plano.
 */
interface ReservacionResponse extends Omit<Reservacion, "mesaEtiqueta"> {
  mesaEtiqueta?: string | null;
  mesa?: { etiqueta: string } | null;
}

function toReservacion(raw: ReservacionResponse): Reservacion {
  return {
    ...raw,
    mesaEtiqueta: raw.mesaEtiqueta ?? raw.mesa?.etiqueta ?? null,
    clienteTelefono: raw.clienteTelefono ?? undefined,
    notas: raw.notas ?? undefined,
    motivoCancelacion: raw.motivoCancelacion ?? undefined,
  };
}

export const httpApi: ApiClient = {
  // --- Restaurante (configuración del negocio) ---
  getRestaurante: () => request<Restaurante>("/restaurante"),
  updateRestaurante: (input: UpdateRestauranteInput) =>
    request<Restaurante>("/restaurante", { method: "PATCH", ...json(input) }),
  uploadLogo: (archivo: File) => {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return request<UploadImagenResult>("/uploads/logo", { method: "POST", body: formData });
  },

  // --- Plano: salones, plantillas y mesas ---
  listSalones: () => request<Salon[]>("/salones"),
  listPlantillas: (salonId) =>
    request<Plantilla[]>(`/salones/${encodeURIComponent(salonId)}/plantillas`),
  getPlantilla: (plantillaId) =>
    request<PlantillaDetalle>(`/plantillas/${encodeURIComponent(plantillaId)}`),
  createPlantilla: (salonId, input: CreatePlantillaInput) =>
    request<Plantilla>(`/salones/${encodeURIComponent(salonId)}/plantillas`, {
      method: "POST",
      ...json(input),
    }),
  updatePlantilla: (plantillaId, input: UpdatePlantillaInput) =>
    request<Plantilla>(`/plantillas/${encodeURIComponent(plantillaId)}`, {
      method: "PATCH",
      ...json(input),
    }),
  deletePlantilla: (plantillaId) =>
    request<void>(`/plantillas/${encodeURIComponent(plantillaId)}`, { method: "DELETE" }),
  activarPlantilla: (plantillaId) =>
    request<ActivarPlantillaResult>(`/plantillas/${encodeURIComponent(plantillaId)}/activar`, {
      method: "POST",
      ...json({}),
    }),
  listMesas: (salonId) =>
    request<Mesa[]>(`/mesas${salonId ? `?salonId=${encodeURIComponent(salonId)}` : ""}`),
  createPlantillaMesa: (plantillaId, input: CreatePlantillaMesaInput) =>
    request<PlantillaMesa>(`/plantillas/${encodeURIComponent(plantillaId)}/mesas`, {
      method: "POST",
      ...json(input),
    }),
  updatePlantillaMesa: (plantillaId, mesaId, input: UpdatePlantillaMesaInput) =>
    request<PlantillaMesa>(
      `/plantillas/${encodeURIComponent(plantillaId)}/mesas/${encodeURIComponent(mesaId)}`,
      { method: "PATCH", ...json(input) },
    ),
  deletePlantillaMesa: (plantillaId, mesaId) =>
    request<void>(
      `/plantillas/${encodeURIComponent(plantillaId)}/mesas/${encodeURIComponent(mesaId)}`,
      { method: "DELETE" },
    ),
  updateMesa: (mesaId, input: UpdateMesaInput) =>
    request<Mesa>(`/mesas/${encodeURIComponent(mesaId)}`, { method: "PATCH", ...json(input) }),
  deleteMesa: (mesaId) =>
    request<void>(`/mesas/${encodeURIComponent(mesaId)}`, { method: "DELETE" }),
  getPlano: async (salonId, plantillaId) => {
    const params = new URLSearchParams({ salonId });
    if (plantillaId) params.set("plantillaId", plantillaId);
    const rows = await request<MesaEstadoRow[]>(`/plano?${params.toString()}`);
    return rows.map(toMesaEstado);
  },

  // --- Menú ---
  listCategorias: () => request<Categoria[]>("/categorias"),
  createCategoria: (nombre) =>
    request<Categoria>("/categorias", { method: "POST", ...json({ nombre }) }),
  listProductos: () => request<Producto[]>("/productos"),
  uploadProductoImagen: (archivo: File) => {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return request<UploadImagenResult>("/uploads/productos", { method: "POST", body: formData });
  },
  createProducto: (input: CreateProductoInput) =>
    request<Producto>("/productos", { method: "POST", ...json(input) }),
  updateProducto: (id, input: UpdateProductoInput) =>
    request<Producto>(`/productos/${id}`, { method: "PATCH", ...json(input) }),
  setProductoDisponibilidad: (id, disponible) =>
    request<Producto>(`/productos/${id}/disponibilidad`, {
      method: "PATCH",
      ...json({ disponible }),
    }),
  deleteProducto: (id) => request<void>(`/productos/${id}`, { method: "DELETE" }),

  // --- Comandas (el PEDIDO) ---
  createComanda: async (input: CreateComandaInput) => {
    // `items` viaja obligatorio y con al menos uno: la comanda nace encolada.
    // `tipo` default `mesa` porque es lo que pide toda pantalla de salón.
    const creada = await request<ComandaResponse>("/comandas", {
      method: "POST",
      ...json({
        tipo: input.tipo ?? "mesa",
        mesaId: input.mesaId,
        comensales: input.comensales,
        reservacionId: input.reservacionId,
        notas: input.notas,
        items: input.items,
      }),
    });
    return toComanda(creada, input.mesaEtiqueta);
  },
  getComanda: async (id) => {
    const detalle = await request<ComandaResponse>(`/comandas/${encodeURIComponent(id)}`);
    return toComanda(detalle);
  },
  addComandaItems: async (comandaId, items: AddComandaItemInput[]) => {
    const creados = await request<RawComandaItem[]>(
      `/comandas/${encodeURIComponent(comandaId)}/items`,
      { method: "POST", ...json({ items }) },
    );
    return creados.map(toComandaItem);
  },
  removeComandaItem: (comandaId, itemId, motivo) =>
    request<void>(
      `/comandas/${encodeURIComponent(comandaId)}/items/${encodeURIComponent(itemId)}`,
      { method: "DELETE", ...json({ motivo }) },
    ),
  despacharComanda: async (comandaId) =>
    toComanda(
      await request<ComandaResponse>(`/comandas/${encodeURIComponent(comandaId)}/despachar`, {
        method: "POST",
        ...json({}),
      }),
    ),
  anularComanda: async (comandaId, motivo) =>
    toComanda(
      await request<ComandaResponse>(`/comandas/${encodeURIComponent(comandaId)}/anular`, {
        method: "POST",
        ...json({ motivo }),
      }),
    ),

  // --- Despacho y cobro ---
  getColaDespacho: async () => {
    // El backend ya la devuelve ordenada por `creada_en ASC`; no se reordena
    // aquí para que el FIFO tenga una sola definición, la del servidor.
    const rows = await request<ColaDespachoRow[]>("/despacho/cola");
    return rows.map(toComandaEnCola);
  },
  getCuentasPorCobrar: async () => {
    const rows = await request<CuentaMesaRow[]>("/cuentas-por-cobrar");
    return rows.map(toCuentaMesa);
  },
  getCuentaDeMesa: async (mesaId) => {
    // Respuesta MIXTA a propósito: `mesa` y `comandas` salen de Prisma
    // (camelCase) y `cuenta` es una fila cruda de `v_cuenta_mesa` (snake_case).
    const raw = await request<{
      mesa: Mesa;
      cuenta: CuentaMesaRow | null;
      comandas: ComandaResponse[];
    }>(`/mesas/${encodeURIComponent(mesaId)}/cuenta`);
    return {
      mesa: raw.mesa,
      cuenta: raw.cuenta ? toCuentaMesa(raw.cuenta) : null,
      comandas: (raw.comandas ?? []).map((comanda) => toComanda(comanda, raw.mesa?.etiqueta)),
    } satisfies CuentaDeMesa;
  },
  cobrarMesa: async (mesaId, input: CobrarMesaInput) =>
    toCobro(
      await request<CobroResponse>(`/mesas/${encodeURIComponent(mesaId)}/cobrar`, {
        method: "POST",
        ...json(input),
      }),
    ),
  getCobro: async (cobroId) =>
    toCobro(await request<CobroResponse>(`/cobros/${encodeURIComponent(cobroId)}`)),
  listCobrosDelDia: async () => {
    // El backend no expone el listado de facturas de un día: `CONTRACT.md`
    // sólo define `GET /cobros/:id`. Se devuelve `null` (no `[]`) para que
    // Ventas diga la verdad en vez de fingir que hoy no se cobró nada.
    return null;
  },

  // --- Tasa de cambio ---
  // `GET /tasa/vigente` responde 200 siempre — `usd`/`eur` vienen `null` si el
  // restaurante todavía no registró ninguna, así que no hace falta el try/catch
  // que sí necesitaban otros endpoints con 400/404 como "estado normal".
  getTasaVigente: () => request<TasaVigente>("/tasa/vigente"),
  registrarTasa: (valor, fuente: FuenteTasa, divisa?: DivisaTasa) =>
    request<TasaDivisa>("/tasa", { method: "POST", ...json({ valor, fuente, divisa }) }),
  actualizarTasa: () => request<TasaVigente>("/tasa/actualizar", { method: "POST" }),

  // --- Reservaciones ---
  listReservaciones: async () =>
    (await request<ReservacionResponse[]>("/reservaciones")).map(toReservacion),
  createReservacion: async (input: CreateReservacionInput) =>
    toReservacion(
      await request<ReservacionResponse>("/reservaciones", { method: "POST", ...json(input) }),
    ),
  confirmarReservacion: async (id) =>
    toReservacion(
      await request<ReservacionResponse>(`/reservaciones/${id}/confirmar`, { method: "POST" }),
    ),
  cancelarReservacion: async (id, motivo) =>
    toReservacion(
      await request<ReservacionResponse>(`/reservaciones/${id}/cancelar`, {
        method: "POST",
        ...json({ motivo }),
      }),
    ),
  sentarReservacion: async (id) => {
    // Ya NO devuelve `{ reservacion, comanda }`: sentar no abre comanda, y la
    // mesa queda ocupada igual porque `v_mesa_estado` cuenta la reserva
    // sentada como ocupación por sí sola.
    const result = await request<{ reservacion: ReservacionResponse }>(
      `/reservaciones/${encodeURIComponent(id)}/sentar`,
      { method: "POST", ...json({}) },
    );
    return toReservacion(result.reservacion);
  },
  buscarReservacionPorCodigo: async (codigo) => {
    try {
      return toReservacion(
        await request<ReservacionResponse>(`/publico/reserva/${encodeURIComponent(codigo)}`),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  asignarMesaReservacion: async (codigoPublico, mesaId) =>
    toReservacion(
      await request<ReservacionResponse>(
        `/publico/reserva/${encodeURIComponent(codigoPublico)}/mesa`,
        { method: "POST", ...json({ mesaId }) },
      ),
    ),
  checkinReservacionPublica: async (codigoPublico) =>
    toReservacion(
      await request<ReservacionResponse>(
        `/publico/reserva/${encodeURIComponent(codigoPublico)}/checkin`,
        { method: "POST", ...json({}) },
      ),
    ),

  // --- Reportes ---
  // `/reportes/dia` y `/reportes/productos` también devuelven filas crudas de
  // vista (`v_venta_dia`, `v_producto_vendido_dia`) en snake_case. El shape
  // documentado `{ fecha, totalVentasUsd, numeroComandas }` no existe: lo que
  // llega es `{ porTurno, total: { comandas, comensales, total_usd, ... } }`.
  getReporteDia: async (fecha) => {
    const data = await request<{ total: VentaDiaRow | null }>(`/reportes/dia?fecha=${fecha}`);
    return toReporteDia(fecha, data.total);
  },
  getReporteProductos: async (orden: OrdenReporteProducto, limite = 10, fecha) => {
    // `desde`/`hasta` NO son opcionales en la práctica: sin ellos el backend
    // devuelve [] aunque el día tenga ventas. Verificado contra el real.
    const params = new URLSearchParams({ orden, limite: String(limite) });
    if (fecha) {
      params.set("desde", fecha);
      params.set("hasta", fecha);
    }
    const rows = await request<ProductoVendidoRow[]>(`/reportes/productos?${params.toString()}`);
    return rows.map(toProductoVendido);
  },
  // `/reportes/ventas` sí responde en camelCase tal cual el contrato (a
  // diferencia de los dos de arriba) — no necesita ningún mapeo en el borde.
  getReporteVentas: (periodo: PeriodoReporte = "dia", fecha) => {
    const params = new URLSearchParams({ periodo });
    if (fecha) params.set("fecha", fecha);
    return request<ReporteVentas>(`/reportes/ventas?${params.toString()}`);
  },

  // --- Meseros: accesos temporales ---------------------------------------
  getVencimientosAcceso: () => request<AccesoVencimientos>("/accesos/vencimientos"),
  createAcceso: (input: CreateAccesoInput) =>
    request<AccesoCreadoResult>("/accesos", { method: "POST", ...json(input) }),
  listAccesos: () => request<AccesoTemporal[]>("/accesos"),
  updateAcceso: (id, input: UpdateAccesoInput) =>
    request<AccesoTemporal>(`/accesos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      ...json(input),
    }),
  regenerarAcceso: (id, input?: RegenerarAccesoInput) =>
    request<RegenerarAccesoResult>(`/accesos/${encodeURIComponent(id)}/regenerar`, {
      method: "POST",
      ...json(input ?? {}),
    }),
  deleteAcceso: (id) => request<void>(`/accesos/${encodeURIComponent(id)}`, { method: "DELETE" }),
  // Públicos, sin sesión: `request()` sólo agrega `Authorization` si hay un
  // token guardado (nunca lo exige), así que estas dos llamadas funcionan
  // igual estando o no logueado.
  consultarAcceso: (input: ConsultarAccesoInput) =>
    request<ConsultarAccesoResult>("/auth/acceso/consultar", { method: "POST", ...json(input) }),
  canjearAcceso: (input: CanjearAccesoInput) =>
    request<CanjearAccesoResult>("/auth/acceso", { method: "POST", ...json(input) }),

  // --- Web Push ---
  getClaveVapid: () => request<ClaveVapid>("/push/vapid"),
  probarPush: () => request<ResultadoPruebaPush>("/push/probar", { method: "POST", ...json({}) }),
  crearSuscripcionPush: (input: SuscripcionPushInput) =>
    request<SuscripcionPushCreada>("/push/suscripciones", { method: "POST", ...json(input) }),
  listSuscripcionesPush: () => request<SuscripcionPush[]>("/push/suscripciones"),
  actualizarSuscripcionPush: (id, input: ActualizarSuscripcionPushInput) =>
    request<void>(`/push/suscripciones/${encodeURIComponent(id)}`, {
      method: "PATCH",
      ...json(input),
    }),
  eliminarSuscripcionPush: (endpoint) =>
    request<void>("/push/suscripciones", { method: "DELETE", ...json({ endpoint }) }),
};
