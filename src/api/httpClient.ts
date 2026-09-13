import type {
  AddComandaItemInput,
  ApiClient,
  Categoria,
  Comanda,
  ComandaItem,
  CreateComandaInput,
  CreateProductoInput,
  CreateReservacionInput,
  EstadoComandaItem,
  OrdenReporteProducto,
  Producto,
  ProductoVendido,
  ReporteDia,
  Reservacion,
  UpdateProductoInput,
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

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
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

export const httpApi: ApiClient = {
  // --- Menú ---
  listCategorias: () => request<Categoria[]>("/categorias"),
  createCategoria: (nombre) =>
    request<Categoria>("/categorias", { method: "POST", ...json({ nombre }) }),
  listProductos: () => request<Producto[]>("/productos"),
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
  listComandasActivas: () => request<Comanda[]>("/comandas/activas"),
  createComanda: (input: CreateComandaInput) =>
    request<Comanda>("/comandas", {
      method: "POST",
      ...json({
        tipo: "mesa",
        mesaId: input.mesaId,
        comensales: input.comensales,
        reservacionId: input.reservacionId,
      }),
    }),
  getComanda: (id) => request<Comanda>(`/comandas/${id}`),
  addComandaItems: (comandaId, items: AddComandaItemInput[]) =>
    request<ComandaItem[]>(`/comandas/${comandaId}/items`, {
      method: "POST",
      ...json({ items }),
    }),
  setComandaItemEstado: (comandaId, itemId, estado: EstadoComandaItem) =>
    request<ComandaItem>(`/comandas/${comandaId}/items/${itemId}/estado`, {
      method: "PATCH",
      ...json({ estado }),
    }),
  removeComandaItem: (comandaId, itemId, motivo) =>
    request<void>(`/comandas/${comandaId}/items/${itemId}`, {
      method: "DELETE",
      ...json({ motivo }),
    }),
  pedirCuenta: (comandaId) =>
    request<Comanda>(`/comandas/${comandaId}/cuenta`, { method: "POST" }),
  cobrarComanda: (comandaId) =>
    request<Comanda>(`/comandas/${comandaId}/cobrar`, { method: "POST", ...json({ pagos: [] }) }),
  anularComanda: (comandaId, motivo) =>
    request<Comanda>(`/comandas/${comandaId}/anular`, { method: "POST", ...json({ motivo }) }),

  // --- Reservaciones ---
  listReservaciones: () => request<Reservacion[]>("/reservaciones"),
  createReservacion: (input: CreateReservacionInput) =>
    request<Reservacion>("/reservaciones", { method: "POST", ...json(input) }),
  confirmarReservacion: (id) =>
    request<Reservacion>(`/reservaciones/${id}/confirmar`, { method: "POST" }),
  cancelarReservacion: (id, motivo) =>
    request<Reservacion>(`/reservaciones/${id}/cancelar`, { method: "POST", ...json({ motivo }) }),
  sentarReservacion: (id) =>
    request<{ reservacion: Reservacion; comanda: Comanda }>(`/reservaciones/${id}/sentar`, {
      method: "POST",
      ...json({}),
    }),
  buscarReservacionPorCodigo: async (codigo) => {
    try {
      return await request<Reservacion>(`/publico/reserva/${encodeURIComponent(codigo)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  asignarMesaReservacion: (codigoPublico, mesaId) =>
    request<Reservacion>(`/publico/reserva/${encodeURIComponent(codigoPublico)}/mesa`, {
      method: "POST",
      ...json({ mesaId }),
    }),

  // --- Reportes ---
  getReporteDia: async (fecha) => {
    const data = await request<{ total: ReporteDia }>(`/reportes/dia?fecha=${fecha}`);
    return data.total;
  },
  getReporteProductos: (orden: OrdenReporteProducto, limite = 10) =>
    request<ProductoVendido[]>(`/reportes/productos?orden=${orden}&limite=${limite}`),
};
