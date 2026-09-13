/**
 * Wire-level domain types for the Hayai Comandas backend.
 *
 * Field names, enum values and shapes here follow `CONTRACT.md` in the
 * backend repo (hayai-comandas-restaurantes-backend), authored by J.O.R.B.I:
 * camelCase on the wire, money fields as `string` (the backend serializes
 * Prisma `Decimal` this way — never do currency arithmetic on these as
 * `number` without parsing first).
 *
 * Simplification disclosed: the backend models `Mesa` (stable identity),
 * `Salon` and `Plantilla`/`PlantillaMesa` (layout) as separate entities. The
 * floor plan editor already shipped in this app (`useFloorPlanStore`) flattens
 * that into a single `RestaurantTable` per active template, and this frontend
 * has no multi-salon UI yet. Every place below that needs a "table" uses that
 * store's `RestaurantTable.id` as the `mesaId` — swapping to the real
 * multi-salon model later touches this file and the mock/http clients, not
 * the screens.
 */

export type EstadoReservacion =
  | "pendiente"
  | "confirmada"
  | "sentada"
  | "completada"
  | "cancelada"
  | "no_show";

export type OrigenReservacion = "personal" | "enlace_publico";

export type EstadoComanda = "abierta" | "por_cobrar" | "cobrada" | "anulada";

export type EstadoComandaItem = "pendiente" | "en_preparacion" | "servido" | "cancelado";

export type DestinoPreparacion = "cocina" | "barra" | "ninguno";

export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
}

export interface Producto {
  id: string;
  categoriaId: string;
  categoriaNombre: string;
  nombre: string;
  descripcion?: string;
  /** USD, decimal-as-string per contract. */
  precio: string;
  destino: DestinoPreparacion;
  /** The daily "se acabó" toggle — distinct from `activo`. */
  disponible: boolean;
  /** Whether it's on the menu at all. */
  activo: boolean;
  orden: number;
}

export interface Reservacion {
  id: string;
  mesaId: string | null;
  mesaEtiqueta: string | null;
  clienteNombre: string;
  clienteTelefono?: string;
  personas: number;
  /** ISO 8601 with zone. */
  iniciaEn: string;
  terminaEn: string;
  estado: EstadoReservacion;
  origen: OrigenReservacion;
  /** High-entropy, goes in the QR / self-seat link. Unique globally. */
  codigoPublico: string;
  /** Short human-readable code for the door / check-in counter. */
  codigoCorto: string;
  notas?: string;
  motivoCancelacion?: string;
}

export interface ComandaItem {
  id: string;
  productoId: string;
  /** Snapshot at order time — never re-read the live product name/price. */
  nombreSnap: string;
  precioUnitarioSnap: string;
  cantidad: number;
  totalLinea: string;
  estado: EstadoComandaItem;
  nota?: string;
}

export interface Comanda {
  id: string;
  mesaId: string;
  mesaEtiqueta: string;
  reservacionId?: string;
  /** Guest name, carried over from the reservation when there is one. */
  clienteNombre?: string;
  comensales: number;
  estado: EstadoComanda;
  abiertaEn: string;
  cerradaEn?: string;
  items: ComandaItem[];
  subtotal: string;
  total: string;
}

export interface ProductoVendido {
  productoId: string;
  nombre: string;
  cantidad: number;
  ingresoUsd: string;
}

export interface ReporteDia {
  fecha: string;
  totalVentasUsd: string;
  numeroComandas: number;
}

export type OrdenReporteProducto = "cantidad" | "ingreso";

export interface CreateProductoInput {
  categoriaId: string;
  nombre: string;
  precio: string;
  destino: DestinoPreparacion;
  disponible?: boolean;
}

export type UpdateProductoInput = Partial<
  Pick<Producto, "nombre" | "precio" | "categoriaId" | "destino" | "activo">
>;

export interface CreateReservacionInput {
  mesaId?: string;
  mesaEtiqueta?: string;
  clienteNombre: string;
  clienteTelefono?: string;
  personas: number;
  iniciaEn: string;
  duracionMin?: number;
  notas?: string;
}

export interface CreateComandaInput {
  mesaId: string;
  mesaEtiqueta: string;
  comensales?: number;
  reservacionId?: string;
  clienteNombre?: string;
}

export interface AddComandaItemInput {
  productoId: string;
  cantidad: number;
  nota?: string;
}

/** Thrown by both clients so screens can render one error shape. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiClient {
  // --- Menú ---
  listCategorias(): Promise<Categoria[]>;
  createCategoria(nombre: string): Promise<Categoria>;
  listProductos(): Promise<Producto[]>;
  createProducto(input: CreateProductoInput): Promise<Producto>;
  updateProducto(id: string, input: UpdateProductoInput): Promise<Producto>;
  setProductoDisponibilidad(id: string, disponible: boolean): Promise<Producto>;
  deleteProducto(id: string): Promise<void>;

  // --- Comandas ---
  listComandasActivas(): Promise<Comanda[]>;
  createComanda(input: CreateComandaInput): Promise<Comanda>;
  getComanda(id: string): Promise<Comanda>;
  addComandaItems(comandaId: string, items: AddComandaItemInput[]): Promise<ComandaItem[]>;
  setComandaItemEstado(
    comandaId: string,
    itemId: string,
    estado: EstadoComandaItem,
  ): Promise<ComandaItem>;
  removeComandaItem(comandaId: string, itemId: string, motivo: string): Promise<void>;
  pedirCuenta(comandaId: string): Promise<Comanda>;
  cobrarComanda(comandaId: string): Promise<Comanda>;
  anularComanda(comandaId: string, motivo: string): Promise<Comanda>;

  // --- Reservaciones ---
  listReservaciones(): Promise<Reservacion[]>;
  createReservacion(input: CreateReservacionInput): Promise<Reservacion>;
  confirmarReservacion(id: string): Promise<Reservacion>;
  cancelarReservacion(id: string, motivo: string): Promise<Reservacion>;
  sentarReservacion(id: string): Promise<{ reservacion: Reservacion; comanda: Comanda }>;
  buscarReservacionPorCodigo(codigo: string): Promise<Reservacion | null>;
  asignarMesaReservacion(codigoPublico: string, mesaId: string, mesaEtiqueta: string): Promise<Reservacion>;

  // --- Reportes ---
  getReporteDia(fecha: string): Promise<ReporteDia>;
  getReporteProductos(orden: OrdenReporteProducto, limite?: number): Promise<ProductoVendido[]>;
}
