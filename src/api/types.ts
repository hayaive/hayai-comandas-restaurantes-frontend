/**
 * Wire-level domain types for the Hayai Comandas backend.
 *
 * Field names, enum values and shapes here follow `CONTRACT.md` in the
 * backend repo (hayai-comandas-restaurantes-backend), authored by J.O.R.B.I:
 * camelCase on the wire, money fields as `string` (the backend serializes
 * Prisma `Decimal` this way — never do currency arithmetic on these as
 * `number` without parsing first).
 *
 * The backend models `Mesa` (stable identity), `Salon` and
 * `Plantilla`/`PlantillaMesa` (layout) as separate entities. The floor plan
 * editor flattens that into a single `RestaurantTable` per template for
 * rendering, but `useFloorPlanStore` now loads and writes the real entities:
 * every `mesaId` this app sends to the backend is a real `mesa.id` UUID.
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

export type MetodoPago =
  | "efectivo_usd"
  | "efectivo_bs"
  | "pago_movil"
  | "transferencia"
  | "punto"
  | "binance"
  | "otro";

export type Moneda = "USD" | "BS";

export type FuenteTasa = "bcv" | "manual" | "binance";

/**
 * OJO: `monto` viaja como **number**, no como string. Es la única cifra
 * monetaria del contrato que lo hace — el backend valida `@IsPositive()` sobre
 * un number y rechaza el Decimal-as-string con 400.
 */
export interface PagoInput {
  metodo: MetodoPago;
  moneda: Moneda;
  monto: number;
  /** Obligatoria para `pago_movil` y `transferencia` (conciliación bancaria). */
  referencia?: string;
}

export interface ComandaPago {
  id: string;
  metodo: MetodoPago;
  moneda: Moneda;
  monto: string;
  montoUsd: string;
  referencia?: string;
  recibidoEn: string;
}

export interface CobrarComandaInput {
  propina?: number;
  descuento?: number;
  /** La suma en USD debe cuadrar con el total de la comanda. */
  pagos: PagoInput[];
}

export type DivisaTasa = "USD" | "EUR";

/**
 * Una tasa registrada para una divisa puntual. Shape real de
 * `GET /tasa/vigente` (campos `usd`/`eur`) y de la respuesta de
 * `POST /tasa` — verificado contra el backend real el 2026-09-13.
 */
export interface TasaDivisa {
  id: string;
  restauranteId: string;
  fecha: string;
  divisa: DivisaTasa;
  /** Bs por unidad de divisa, decimal-as-string. */
  valor: string;
  fuente: FuenteTasa;
  registradaPorId: string | null;
  creadaEn: string;
}

/**
 * `GET /tasa/vigente` responde 200 SIEMPRE, nunca 404/400: `usd`/`eur` vienen
 * `null` cuando el restaurante todavía no registró ninguna tasa para esa
 * divisa. Nunca asumas que hay valor — la UI debe manejar ambos `null` con
 * gracia (ver `DualPrice` y `TasaBar`).
 */
export interface TasaVigente {
  fecha: string;
  usd: TasaDivisa | null;
  eur: TasaDivisa | null;
}

export type FormaMesa = "redonda" | "cuadrada" | "rectangular" | "barra";

/**
 * Derived server-side by the `v_mesa_estado` view — never a column, and never
 * something the client decides on its own.
 */
export type EstadoMesa = "libre" | "ocupada" | "reservada" | "bloqueada";

export interface Salon {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

/** A table's stable identity. Survives any redesign of the floor plan. */
export interface Mesa {
  id: string;
  salonId: string;
  /** "5", "T-2". Unique across the whole restaurant among the non-deleted. */
  etiqueta: string;
  capacidadDefault: number;
  formaDefault: FormaMesa;
  activa: boolean;
}

/** A distribution of a salon. Exactly one is `activa` per salon. */
export interface Plantilla {
  id: string;
  salonId: string;
  nombre: string;
  descripcion?: string | null;
  /** Logical canvas of the editor. Decimal-as-string per contract. */
  anchoPlano: string;
  altoPlano: string;
  activa: boolean;
}

/**
 * A table's placement inside one distribution. `posX`/`posY` are the TOP-LEFT
 * corner in plan units — the canvas works in centers, so the store converts.
 */
export interface PlantillaMesa {
  plantillaId: string;
  mesaId: string;
  posX: string;
  posY: string;
  ancho: string;
  alto: string;
  rotacion: number;
  forma: FormaMesa;
  /** Seats in THIS distribution — not the mesa's `capacidadDefault`. */
  capacidad: number;
  bloqueada: boolean;
  /**
   * Identity, embedded by the backend on `GET /plantillas/:id` and on
   * `POST /plantillas/:id/mesas`. Absent on `PATCH …/mesas/:mesaId`.
   */
  mesa?: Mesa;
}

export interface PlantillaDetalle extends Plantilla {
  mesas: PlantillaMesa[];
}

/** One row of `v_mesa_estado`, normalized to camelCase by the client. */
export interface MesaEstado {
  salonId: string;
  plantillaId: string;
  plantillaActiva: boolean;
  mesaId: string;
  etiqueta: string;
  estado: EstadoMesa;
  bloqueada: boolean;
  comandaId: string | null;
  reservacionId: string | null;
  reservacionCliente: string | null;
}

export interface CreatePlantillaInput {
  nombre: string;
  anchoPlano?: number;
  altoPlano?: number;
}

export interface UpdatePlantillaInput {
  nombre?: string;
  descripcion?: string;
  anchoPlano?: number;
  altoPlano?: number;
}

export interface CreatePlantillaMesaInput {
  /** Omit to have the backend create the `mesa` too (adding a brand new table). */
  mesaId?: string;
  etiqueta?: string;
  posX: number;
  posY: number;
  ancho?: number;
  alto?: number;
  rotacion?: number;
  forma?: FormaMesa;
  capacidad?: number;
  bloqueada?: boolean;
}

export interface UpdatePlantillaMesaInput {
  posX?: number;
  posY?: number;
  ancho?: number;
  alto?: number;
  rotacion?: number;
  forma?: FormaMesa;
  capacidad?: number;
  bloqueada?: boolean;
}

export interface UpdateMesaInput {
  etiqueta?: string;
  capacidadDefault?: number;
  formaDefault?: FormaMesa;
  activa?: boolean;
}

export interface ActivarPlantillaResult {
  plantilla: Plantilla;
  /**
   * Reservations whose table is not in the newly activated distribution.
   * Informational: activating is not blocked, the host decides what to do.
   */
  reservacionesHuerfanas: Reservacion[];
}

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
  /** Optional link to a product photo — pasted by staff, no upload flow yet. */
  imagenUrl?: string;
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
  /** Número visible del día, único por (restaurante, fecha operativa). */
  numeroDia?: number;
  abiertaEn: string;
  cerradaEn?: string;
  items: ComandaItem[];
  /** Sólo viene con el detalle (`GET /comandas/:id`) y al cobrar. */
  pagos?: ComandaPago[];
  subtotal: string;
  propina?: string;
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
  comensales: number;
  propinasUsd: string;
}

export type OrdenReporteProducto = "cantidad" | "ingreso";

export interface CreateProductoInput {
  categoriaId: string;
  nombre: string;
  precio: string;
  destino: DestinoPreparacion;
  disponible?: boolean;
  imagenUrl?: string;
}

export type UpdateProductoInput = Partial<
  Pick<Producto, "nombre" | "precio" | "categoriaId" | "destino" | "activo" | "imagenUrl">
>;

export interface CreateReservacionInput {
  /**
   * Obligatorio para el backend (`salonId must be a UUID` si falta). Lo
   * rellena `useReservationStore` desde el salón cargado en el plano, así que
   * las pantallas no tienen que conocerlo.
   */
  salonId?: string;
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
  // --- Plano: salones, plantillas y mesas ---
  listSalones(): Promise<Salon[]>;
  listPlantillas(salonId: string): Promise<Plantilla[]>;
  getPlantilla(plantillaId: string): Promise<PlantillaDetalle>;
  createPlantilla(salonId: string, input: CreatePlantillaInput): Promise<Plantilla>;
  updatePlantilla(plantillaId: string, input: UpdatePlantillaInput): Promise<Plantilla>;
  deletePlantilla(plantillaId: string): Promise<void>;
  activarPlantilla(plantillaId: string): Promise<ActivarPlantillaResult>;
  createPlantillaMesa(
    plantillaId: string,
    input: CreatePlantillaMesaInput,
  ): Promise<PlantillaMesa>;
  updatePlantillaMesa(
    plantillaId: string,
    mesaId: string,
    input: UpdatePlantillaMesaInput,
  ): Promise<PlantillaMesa>;
  deletePlantillaMesa(plantillaId: string, mesaId: string): Promise<void>;
  updateMesa(mesaId: string, input: UpdateMesaInput): Promise<Mesa>;
  /** Operational state of every table, computed server-side by `v_mesa_estado`. */
  getPlano(salonId: string, plantillaId?: string): Promise<MesaEstado[]>;

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
  cobrarComanda(comandaId: string, input: CobrarComandaInput): Promise<Comanda>;
  anularComanda(comandaId: string, motivo: string): Promise<Comanda>;
  /**
   * Comandas cobradas de un día operativo, con su detalle.
   *
   * Devuelve `null` cuando el backend no expone el listado — hoy es el caso:
   * `CONTRACT.md` sólo define `GET /comandas/activas` y `GET /comandas/:id`,
   * no hay forma de pedir el histórico. Las pantallas deben distinguir "no hay
   * comandas cobradas" de "el backend no sabe contestar esto".
   */
  listComandasCobradas(fecha: string): Promise<Comanda[] | null>;

  // --- Tasa de cambio ---
  /** Responde 200 siempre; `usd`/`eur` son `null` si nunca se registró ninguna. */
  getTasaVigente(): Promise<TasaVigente>;
  /** `divisa` por defecto es USD del lado del backend si se omite. */
  registrarTasa(valor: number, fuente: FuenteTasa, divisa?: DivisaTasa): Promise<TasaDivisa>;
  /** Fuerza un fetch inmediato desde la fuente externa (dolarapi.com) y devuelve la tasa vigente actualizada. */
  actualizarTasa(): Promise<TasaVigente>;

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
  /**
   * `fecha` es el día operativo a consultar. No es opcional de verdad contra el
   * backend real: sin rango de fechas devuelve una lista vacía aunque haya
   * ventas. Se deja opcional sólo por compatibilidad del mock.
   */
  getReporteProductos(
    orden: OrdenReporteProducto,
    limite?: number,
    fecha?: string,
  ): Promise<ProductoVendido[]>;
}
