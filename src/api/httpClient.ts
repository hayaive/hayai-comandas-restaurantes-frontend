import type {
  ActivarPlantillaResult,
  AddComandaItemInput,
  ApiClient,
  Categoria,
  Comanda,
  ComandaItem,
  ComandaPago,
  CobrarComandaInput,
  CreateComandaInput,
  CreatePlantillaInput,
  CreatePlantillaMesaInput,
  CreateProductoInput,
  CreateReservacionInput,
  EstadoComandaItem,
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
  ReporteDia,
  ReporteVentas,
  Reservacion,
  Salon,
  DivisaTasa,
  TasaDivisa,
  TasaVigente,
  UpdateMesaInput,
  UpdatePlantillaInput,
  UpdatePlantillaMesaInput,
  UpdateProductoInput,
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
 * OJO — dos endpoints del backend NO respetan el camelCase del contrato:
 * `GET /plano` y `GET /comandas/activas` devuelven las filas crudas de sus
 * vistas SQL (`v_mesa_estado`, `v_comanda_activa`), o sea snake_case. Se
 * normalizan aquí, en el borde, para que ni los stores ni las pantallas tengan
 * que saberlo. Verificado contra el backend real el 2026-09-13.
 */
interface MesaEstadoRow {
  salon_id: string;
  plantilla_id: string;
  plantilla_activa: boolean;
  mesa_id: string;
  etiqueta: string;
  estado: EstadoMesa;
  bloqueada: boolean;
  comanda_id: string | null;
  reservacion_id: string | null;
  reservacion_cliente: string | null;
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
    comandaId: row.comanda_id,
    reservacionId: row.reservacion_id,
    reservacionCliente: row.reservacion_cliente,
  };
}

interface ComandaActivaRow {
  comanda_id: string;
  mesa_id: string | null;
  mesa_etiqueta: string | null;
}

/**
 * `GET /comandas/:id` sí viene en camelCase, con `items` y la `mesa` embebida.
 * `POST /comandas` y `POST /comandas/:id/items` no traen la etiqueta ni los
 * ítems, así que se completan con lo que ya se sabe.
 */
interface ComandaDetalleResponse {
  id: string;
  mesaId: string | null;
  comensales: number;
  estado: Comanda["estado"];
  numeroDia?: number;
  abiertaEn: string;
  cerradaEn?: string | null;
  reservacionId?: string | null;
  subtotal: string;
  propina?: string;
  total: string;
  items?: RawComandaItem[];
  pagos?: ComandaPago[];
  mesa?: { etiqueta: string } | null;
}

interface RawComandaItem {
  id: string;
  productoId: string;
  nombreSnap: string;
  precioUnitarioSnap: string;
  /** Prisma serializa el Decimal como string; el resto de la app lo usa como number. */
  cantidad: string | number;
  totalLinea: string;
  estado: EstadoComandaItem;
  nota?: string | null;
}

function toComandaItem(raw: RawComandaItem): ComandaItem {
  return {
    id: raw.id,
    productoId: raw.productoId,
    nombreSnap: raw.nombreSnap,
    precioUnitarioSnap: raw.precioUnitarioSnap,
    cantidad: Number(raw.cantidad),
    totalLinea: raw.totalLinea,
    estado: raw.estado,
    nota: raw.nota ?? undefined,
  };
}

function toComanda(raw: ComandaDetalleResponse, mesaEtiquetaFallback = ""): Comanda {
  return {
    id: raw.id,
    mesaId: raw.mesaId ?? "",
    mesaEtiqueta: raw.mesa?.etiqueta ?? mesaEtiquetaFallback,
    reservacionId: raw.reservacionId ?? undefined,
    comensales: raw.comensales,
    estado: raw.estado,
    numeroDia: raw.numeroDia,
    abiertaEn: raw.abiertaEn,
    cerradaEn: raw.cerradaEn ?? undefined,
    items: (raw.items ?? []).map(toComandaItem),
    pagos: raw.pagos,
    propina: raw.propina,
    subtotal: raw.subtotal,
    total: raw.total,
  };
}

interface VentaDiaRow {
  comandas?: number;
  comensales?: number;
  total_usd?: string;
  ventas_usd?: string;
  propinas_usd?: string;
}

function toReporteDia(fecha: string, row: VentaDiaRow | null): ReporteDia {
  return {
    fecha,
    totalVentasUsd: row?.total_usd ?? row?.ventas_usd ?? "0",
    numeroComandas: Number(row?.comandas ?? 0),
    comensales: Number(row?.comensales ?? 0),
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

  // --- Comandas ---
  listComandasActivas: async () => {
    // La vista sólo trae un CONTEO de ítems (`items: number`), no el arreglo,
    // así que se hidrata cada comanda con su detalle. Son tantas llamadas como
    // mesas ocupadas haya: acotado por definición.
    const rows = await request<ComandaActivaRow[]>("/comandas/activas");
    const detalles = await Promise.all(
      rows.map(async (row) => {
        const detalle = await request<ComandaDetalleResponse>(
          `/comandas/${encodeURIComponent(row.comanda_id)}`,
        );
        return toComanda(detalle, row.mesa_etiqueta ?? "");
      }),
    );
    return detalles;
  },
  createComanda: async (input: CreateComandaInput) => {
    const creada = await request<ComandaDetalleResponse>("/comandas", {
      method: "POST",
      ...json({
        tipo: "mesa",
        mesaId: input.mesaId,
        comensales: input.comensales,
        reservacionId: input.reservacionId,
      }),
    });
    return toComanda(creada, input.mesaEtiqueta);
  },
  getComanda: async (id) => {
    const detalle = await request<ComandaDetalleResponse>(`/comandas/${encodeURIComponent(id)}`);
    return toComanda(detalle);
  },
  addComandaItems: async (comandaId, items: AddComandaItemInput[]) => {
    const creados = await request<RawComandaItem[]>(`/comandas/${comandaId}/items`, {
      method: "POST",
      ...json({ items }),
    });
    return creados.map(toComandaItem);
  },
  setComandaItemEstado: async (comandaId, itemId, estado: EstadoComandaItem) => {
    const actualizado = await request<RawComandaItem>(
      `/comandas/${comandaId}/items/${itemId}/estado`,
      { method: "PATCH", ...json({ estado }) },
    );
    return toComandaItem(actualizado);
  },
  removeComandaItem: (comandaId, itemId, motivo) =>
    request<void>(`/comandas/${comandaId}/items/${itemId}`, {
      method: "DELETE",
      ...json({ motivo }),
    }),
  cobrarComanda: async (comandaId, input: CobrarComandaInput) => {
    const cobrada = await request<ComandaDetalleResponse>(`/comandas/${comandaId}/cobrar`, {
      method: "POST",
      ...json(input),
    });
    // La respuesta del cobro no embebe la mesa ni los ítems: se relee el
    // detalle para poder archivarla completa en el histórico de Ventas.
    return toComanda(await request<ComandaDetalleResponse>(`/comandas/${comandaId}`), cobrada.mesa?.etiqueta ?? "");
  },
  anularComanda: async (comandaId, motivo) =>
    toComanda(
      await request<ComandaDetalleResponse>(`/comandas/${comandaId}/anular`, {
        method: "POST",
        ...json({ motivo }),
      }),
    ),
  listComandasCobradas: async () => {
    // El backend no expone el histórico: `CONTRACT.md` sólo define
    // `/comandas/activas` y `/comandas/:id`. Probado contra el servidor real:
    // `GET /comandas`, `?estado=cobrada` y `/comandas/cobradas` dan 404/422.
    // Se devuelve `null` (no `[]`) para que Ventas pueda decir la verdad en vez
    // de fingir que hoy no se cobró nada.
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
    const result = await request<{ reservacion: ReservacionResponse; comanda: ComandaDetalleResponse }>(
      `/reservaciones/${id}/sentar`,
      { method: "POST", ...json({}) },
    );
    const reservacion = toReservacion(result.reservacion);
    return { reservacion, comanda: toComanda(result.comanda, reservacion.mesaEtiqueta ?? "") };
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
};
