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
  Reservacion,
  UpdateProductoInput,
} from "./types";
import { ApiError } from "./types";

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

function todayAt(hours: number, minutes = 0): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function shortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `R-${out}`;
}

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

export const mockApi: ApiClient = {
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

  async pedirCuenta(comandaId: string) {
    const idx = comandas.findIndex((c) => c.id === comandaId);
    if (idx === -1) throw new ApiError("La comanda no existe", 404);
    const next: Comanda = { ...comandas[idx], estado: "por_cobrar" };
    comandas = [...comandas.slice(0, idx), next, ...comandas.slice(idx + 1)];
    return delay(next);
  },

  async cobrarComanda(comandaId: string) {
    const idx = comandas.findIndex((c) => c.id === comandaId);
    if (idx === -1) throw new ApiError("La comanda no existe", 404);
    const comanda: Comanda = {
      ...comandas[idx],
      estado: "cobrada",
      cerradaEn: new Date().toISOString(),
    };
    comandas = comandas.filter((c) => c.id !== comandaId);
    comandasCobradasHoy = [...comandasCobradasHoy, comanda];
    return delay(comanda);
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
    void fecha;
    const totalVentasUsd = money(
      comandasCobradasHoy.reduce((sum, c) => sum + Number(c.total), 0),
    );
    return delay({
      fecha,
      totalVentasUsd,
      numeroComandas: comandasCobradasHoy.length,
    });
  },

  async getReporteProductos(orden: OrdenReporteProducto, limite = 10) {
    const byProduct = new Map<string, ProductoVendido>();
    for (const comanda of comandasCobradasHoy) {
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
};
