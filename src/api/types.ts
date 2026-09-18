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

/**
 * DERIVADO por el trigger `comanda_estado` a partir de tres hechos
 * independientes (`despachadaEn`, `cobroId`, `anuladaEn`). El cliente NUNCA lo
 * escribe: manda el hecho (despachar, anular, cobrar) y lee la palabra.
 *
 *   pendiente  → en la cola de despacho   (despachadaEn = null)
 *   despachada → salió de cocina, cobrable (despachadaEn ≠ null)
 *   cobrada    → cubierta por un `Cobro`   (cobroId ≠ null)
 *   anulada    → descartada                (anuladaEn ≠ null)
 */
export type EstadoComanda = "pendiente" | "despachada" | "cobrada" | "anulada";

/**
 * `mesa` exige `mesaId`; `para_llevar` lo exige ausente. El backend deriva
 * `salonId`/`plantillaId` de la mesa, el cliente no los manda.
 */
export type TipoComanda = "mesa" | "para_llevar";

export type TurnoServicio = "desayuno" | "almuerzo" | "cena" | "madrugada";

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
 * En qué moneda se DIBUJAN los precios (UI, ticket, tarjeta de WhatsApp).
 * Puro formato de presentación: cambiarla no toca ni un dato guardado.
 *
 * ⚠️ NO es `Moneda`, y sus valores van en minúscula A PROPÓSITO (decisión de
 * J.O.R.B.I, ver `VistaPrecios` en el schema del backend). `Moneda` es el
 * dominio del COBRO ('USD'/'BS') y el sistema hace `moneda === 'USD' ? monto
 * : monto.div(tasa)` en varios sitios. Si este tipo reusara esos mismos
 * literales, pasar `mostrarPreciosEn` donde se espera un `Moneda` compilaría
 * sin queja (TypeScript es estructural) y dividiría un total entre la tasa
 * por decisión de un ajuste puramente visual. Con 'usd'|'bs'|'ambas' el
 * compilador lo rechaza solo, gratis.
 */
export type MostrarPreciosEn = "usd" | "bs" | "ambas";

/**
 * `GET /restaurante` — la configuración del negocio. Sesión de cualquier rol
 * puede leerla; sólo `administrador` puede tocar `PATCH /restaurante`.
 */
export interface Restaurante {
  id: string;
  slug: string;
  /** Acotado 1–60 caracteres por el backend (`restaurante_nombre_acotado`). */
  nombre: string;
  rif: string | null;
  /**
   * `/uploads/restaurante/<uuid>.<ext>`, o `null` si el dueño todavía no
   * subió ninguno — la UI cae a las iniciales del nombre, nunca a un `<img>`
   * roto. Resolver siempre con `resolveMediaUrl` antes de pintarlo.
   */
  logoUrl: string | null;
  /**
   * Moneda en la que están fijados los precios del menú (siempre 'USD' hoy,
   * clavado por un CHECK del backend). NO es un ajuste editable: no se
   * expone en la pantalla de Configuración. Para "en qué moneda se VE", el
   * campo es `mostrarPreciosEn`.
   */
  monedaBase: Moneda;
  mostrarPreciosEn: MostrarPreciosEn;
  /**
   * Fuera del DTO de `PATCH /restaurante` a propósito: cambiar la hora de
   * corte reasigna a qué día contable pertenece lo que se está vendiendo, y
   * eso es una conversación aparte de esta pantalla. Forma exacta sin
   * verificar contra el backend real — no se lee en ningún sitio del
   * frontend todavía.
   */
  horaCorteDia: string;
  /** Fuera del DTO de `PATCH /restaurante`: cambiarla mueve el QR ya impreso. */
  zonaHoraria: string;
  duracionReservaMin: number;
  permiteAutoseleccion: boolean;
  activo: boolean;
}

/**
 * `PATCH /restaurante`. EXACTAMENTE estos tres campos — `slug`, `monedaBase`,
 * `horaCorteDia` y `zonaHoraria` no son editables aquí (ver los comentarios
 * en `Restaurante`). `logoUrl: null` limpia el logo configurado.
 */
export interface UpdateRestauranteInput {
  nombre?: string;
  logoUrl?: string | null;
  mostrarPreciosEn?: MostrarPreciosEn;
}

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

/**
 * Una línea de pago de un `Cobro` (`cobro_pago`). Antes colgaba de la comanda
 * y se llamaba `ComandaPago`; desde el rediseño cuelga de la factura, porque
 * lo que se paga es la cuenta de la mesa y no un pedido suelto.
 */
export interface CobroPago {
  id: string;
  metodo: MetodoPago;
  moneda: Moneda;
  /** En la moneda de `moneda`. */
  monto: string;
  /** Tasa usada para convertir. `null` cuando `moneda` es USD (la base). */
  tasaAplicada?: string | null;
  montoUsd: string;
  referencia?: string | null;
  recibidoEn: string;
}

/**
 * Cuerpo de `POST /mesas/:mesaId/cobrar`. El cobro es de la MESA: liquida
 * todas sus comandas despachadas y no cobradas en un solo `Cobro`.
 *
 * - `comandaIds` ausente = cobrar todo lo despachado de la mesa. Presente =
 *   cobro parcial, sólo esas.
 * - Lo que sigue en cocina NUNCA entra (CHECK `comanda_cobro_tras_despacho`),
 *   se pidan sus ids o no: queda vivo y arranca la cuenta siguiente.
 * - La suma en USD de `pagos` debe cuadrar con el total (±0.01) o el backend
 *   responde 400. Los totales los calcula el servidor, jamás el cliente.
 */
export interface CobrarMesaInput {
  propina?: number;
  descuento?: number;
  comandaIds?: string[];
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

/**
 * One row of `v_mesa_estado`, normalized to camelCase by the client.
 *
 * ⚠️ `comandaId` DESAPARECIÓ con el rediseño de comandas múltiples: una mesa ya
 * no tiene "la" comanda viva, tiene N. La vista pasó a agregar sobre todas
 * ellas (`comandas`, `cuentaTotal`, …), y además distingue dos reservaciones
 * distintas sobre la misma mesa:
 *
 * - `reservacionId`/`reservacionCliente`: la PRÓXIMA que llega (ventana de
 *   −30 min a +2 h). Es la que pinta la mesa como `reservada`.
 * - `sentadaReservacionId`/`sentadaCliente`: la que YA está sentada ahí. Ocupa
 *   la mesa por sí sola, sin comanda, desde el check-in y hasta que se cobre.
 *   Es lo que hace que el estado optimista del escaneo no se pise en el
 *   siguiente refresco del plano.
 */
export interface MesaEstado {
  salonId: string;
  plantillaId: string;
  plantillaActiva: boolean;
  mesaId: string;
  etiqueta: string;
  estado: EstadoMesa;
  bloqueada: boolean;
  /** Comandas vivas (ni cobradas ni anuladas) de esta mesa. */
  comandas: number;
  /** De las vivas, las que la cocina todavía no despachó. */
  comandasEnCocina: number;
  /** De las vivas, las ya despachadas que esperan pago. */
  comandasPorCobrar: number;
  /** Suma de las comandas vivas, decimal-as-string. */
  cuentaTotal: string;
  /** Primer pedido, o el check-in si todavía no pidieron nada. */
  ocupadaDesde: string | null;
  comensales: number;
  reservacionId: string | null;
  reservacionCliente: string | null;
  sentadaReservacionId: string | null;
  sentadaCliente: string | null;
  sentadaEn: string | null;
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
  /**
   * Public URL of the product photo, e.g. `/uploads/productos/<uuid>.jpg`.
   * Populated by uploading a file via `uploadProductoImagen` first — the
   * backend stores it on local disk (see CONTRACT.md) and returns this URL.
   */
  imagenUrl?: string;
}

/** Response of `uploadProductoImagen` — the URL to save as `Producto.imagenUrl`. */
export interface UploadImagenResult {
  url: string;
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

/**
 * Una línea de comanda.
 *
 * ⚠️ NO hay workflow por ítem: se fueron `estado`
 * (`pendiente`/`en_preparacion`/`servido`), `enviadoEn` y `servidoEn`. La
 * cocina despacha la comanda entera, así que esos estados no tenían quién los
 * moviera. Lo único que le puede pasar a una línea es anularse, y eso se
 * reconoce por `canceladoEn != null` — y sólo mientras la comanda siga
 * `pendiente` (trigger `comanda_item_solo_pendiente`, → 409).
 */
export interface ComandaItem {
  id: string;
  productoId: string;
  /** Snapshot at order time — never re-read the live product name/price. */
  nombreSnap: string;
  precioUnitarioSnap: string;
  destinoSnap: DestinoPreparacion;
  /** `Decimal(14,3)` en la base; el cliente lo normaliza a `number`. */
  cantidad: number;
  totalLinea: string;
  nota?: string | null;
  /** Anulada ⟺ no es `null`. No se borra: la traza sobrevive en el ticket. */
  canceladoEn?: string | null;
}

/**
 * UN PEDIDO, no la cuenta de la mesa.
 *
 * Cada envío a cocina es una comanda nueva y una mesa acumula N vivas a la
 * vez; su cuenta es la suma de todas (`CuentaMesa`). Lo que se cobra es la
 * mesa, y eso emite un `Cobro`.
 *
 * Nace ya en la cola de despacho con sus líneas: no hay borrador, y `total` es
 * SÓLO la suma de sus líneas vivas — descuento, impuesto y propina se negocian
 * sobre la cuenta de la mesa y viven en `Cobro` (un ticket de cocina no tiene
 * propina). Por eso aquí ya no hay `subtotal`, `propina`, `abiertaEn` ni
 * `cerradaEn`.
 */
export interface Comanda {
  id: string;
  tipo: TipoComanda;
  /** `null` sólo en `para_llevar`. */
  mesaId: string | null;
  /** No viene del backend en todas las respuestas; se completa en el borde. */
  mesaEtiqueta?: string | null;
  salonId?: string | null;
  reservacionId?: string | null;
  /** Número visible del día, único por (restaurante, fecha operativa). */
  numeroDia: number;
  comensales: number;
  meseroId?: string | null;
  /** Derivado por el servidor. Nunca se manda en un PATCH. */
  estado: EstadoComanda;
  creadaEn: string;
  despachadaEn?: string | null;
  anuladaEn?: string | null;
  /** La factura que la cubre. `null` = sigue en la cuenta viva de la mesa. */
  cobroId?: string | null;
  /** Suma de las líneas VIVAS, decimal-as-string. Lo recalcula el servidor. */
  total: string;
  notas?: string | null;
  items: ComandaItem[];
}

/** Una línea embebida en el jsonb de `v_cola_despacho`. */
export interface ColaDespachoItem {
  id: string;
  nombre: string;
  cantidad: number;
  destino: DestinoPreparacion;
  nota?: string | null;
  /**
   * Los cancelados VIENEN en la cola a propósito, marcados: la cocina tiene
   * que ver que algo se anuló si ya lo había empezado.
   */
  cancelado: boolean;
}

/**
 * Una fila de `v_cola_despacho` (`GET /despacho/cola`), normalizada.
 *
 * La cola es GLOBAL —todas las mesas juntas— y FIFO estricto por `creadaEn`.
 * La unidad es la COMANDA, no el ítem: cocina y barra despachan el pedido
 * entero. Las líneas vienen embebidas para que el KDS no haga un N+1 cada vez
 * que refresca.
 */
export interface ComandaEnCola {
  comandaId: string;
  tipo: TipoComanda;
  mesaId: string | null;
  mesaEtiqueta: string | null;
  numeroDia: number;
  creadaEn: string;
  minutosEnCola: number;
  meseroId: string | null;
  meseroNombre: string | null;
  comensales: number;
  total: string;
  notas: string | null;
  items: ColaDespachoItem[];
}

/**
 * Una fila de `v_cuenta_mesa`: la cuenta viva de una mesa.
 *
 * Alimenta las DOS entradas al mismo dato: `GET /cuentas-por-cobrar` (todas
 * las mesas con `comandasPorCobrar > 0`) y `GET /mesas/:mesaId/cuenta` (una
 * sola). Incluye a propósito lo que todavía está en cocina: el cajero necesita
 * verlo antes de cerrar, porque cobrar deja eso vivo y abre una cuenta nueva.
 */
export interface CuentaMesa {
  mesaId: string;
  mesaEtiqueta: string;
  salonId: string | null;
  salonNombre: string | null;
  /** Comandas vivas en total. */
  comandas: number;
  /** Ya despachadas: lo que se puede cobrar ahora. */
  comandasPorCobrar: number;
  /** Todavía en cocina: NO entra en este cobro. */
  comandasEnCocina: number;
  cuentaTotal: string;
  totalPorCobrar: string;
  totalEnCocina: string;
  comensales: number;
  ocupadaDesde: string;
  minutosOcupada: number;
  meseroId: string | null;
  reservacionId: string | null;
}

/**
 * `GET /mesas/:mesaId/cuenta`. Responde 200 con `cuenta: null` y
 * `comandas: []` cuando la mesa está libre — "esta mesa no debe nada" es una
 * respuesta, no un 404.
 */
export interface CuentaDeMesa {
  mesa: Mesa;
  cuenta: CuentaMesa | null;
  /** Las comandas vivas que la componen, con sus líneas, en orden FIFO. */
  comandas: Comanda[];
}

/**
 * LA FACTURA: la cuenta consolidada de una mesa, que reúne N comandas
 * despachadas. Es lo reimprimible (`GET /cobros/:id`).
 *
 * Comprobante INTERNO de cobro, no un documento fiscal: sin IVA discriminado
 * ni correlativo SENIAT.
 */
export interface Cobro {
  id: string;
  mesaId: string | null;
  salonId: string | null;
  /** Número visible de la factura del día. Contador propio, distinto al de la comanda. */
  numeroDia: number;
  fechaOperativa: string;
  turno: TurnoServicio;
  comensales: number;
  subtotal: string;
  descuento: string;
  impuesto: string;
  propina: string;
  total: string;
  /** Congelados al emitir para poder reimprimir el mismo monto en Bs. */
  tasaValor: string;
  totalBs: string;
  cobradoEn: string;
  anuladoEn?: string | null;
  motivoAnulacion?: string | null;
  notas?: string | null;
  pagos: CobroPago[];
  /** Las comandas que cubre, con sus líneas. */
  comandas: Comanda[];
  /** Sólo viene en `GET /cobros/:id`; el POST de cobro no la embebe. */
  mesa?: Mesa | null;
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
  /** Facturas emitidas. La columna de `v_venta_dia` pasó de `comandas` a `cobros`. */
  numeroCobros: number;
  comensales: number;
  propinasUsd: string;
}

export type OrdenReporteProducto = "cantidad" | "ingreso";

/** Período consultable en `GET /reportes/ventas`. Sin eñe: va tal cual en la URL. */
export type PeriodoReporte = "dia" | "mes" | "anio";

/** Cómo viene desglosada `ReporteVentas.serie` según el período pedido. */
export type GranularidadSerie = "turno" | "dia" | "mes";

/**
 * Totales monetarios de un tramo de ventas. Todos los campos de dinero son
 * `string` — `numeric(14,4)` de Postgres serializado tal cual, nunca hagas
 * aritmética con ellos como `number` sin convertir explícitamente primero.
 */
export interface VentaResumen {
  /**
   * Facturas emitidas = mesas atendidas. ⚠️ CAMBIO DE CONTRATO: se llamaba
   * `comandas` cuando una comanda ERA la cuenta de la mesa. Hoy una mesa
   * genera varias comandas y UNA factura, así que contar comandas ya no
   * respondía "cuántas mesas vendimos" ni servía de denominador del ticket
   * promedio.
   */
  cobros: number;
  comensales: number;
  totalUsd: string;
  /** Ventas SIN propina. */
  ventasUsd: string;
  propinasUsd: string;
  descuentosUsd: string;
  impuestosUsd: string;
  /** `'0.0000'` cuando el tramo no tuvo ventas. */
  ticketPromedioUsd: string;
}

export interface VentaPunto extends VentaResumen {
  /**
   * `'desayuno'|'almuerzo'|'cena'|'madrugada'` cuando `periodo` es `dia`,
   * `'YYYY-MM-DD'` cuando es `mes`, `'YYYY-MM'` cuando es `anio`.
   */
  clave: string;
}

/**
 * Respuesta de `GET /reportes/ventas?periodo=&fecha=`, ya en camelCase (a
 * diferencia de `/reportes/dia` y `/reportes/productos`, que siguen en
 * snake_case con filas crudas de vista).
 */
export interface ReporteVentas {
  periodo: PeriodoReporte;
  /** Día operativo ancla de la consulta, `'YYYY-MM-DD'`. */
  fecha: string;
  /** Primer día operativo incluido en el tramo. */
  desde: string;
  /** Último día operativo incluido — ya recortado a hoy si el tramo está en curso. */
  hasta: string;
  /** `true` si `hasta` es hoy: la cifra todavía se está moviendo. */
  enCurso: boolean;
  total: VentaResumen;
  granularidad: GranularidadSerie;
  /** Densa: los buckets sin venta vienen en cero, no faltan. */
  serie: VentaPunto[];
  /**
   * Período anterior completo si el consultado ya cerró, o el mismo tramo
   * transcurrido si `enCurso` es `true` — no asumir que siempre es "el mes
   * anterior completo".
   */
  comparacion: { desde: string; hasta: string; total: VentaResumen };
}

/**
 * Los "canales" en los que el backend agrupa los eventos que dispara por
 * push. Hoy sólo emite los dos primeros (comanda nueva a cocina/barra); los
 * otros dos están en el contrato pero el backend todavía no los envía — no
 * asumir que suscribirse a ellos ya trae nada.
 */
export type TemaPush =
  | "comanda_cocina"
  | "comanda_barra"
  | "cuenta_por_cobrar"
  | "reservacion_nueva";

/** `GET /push/vapid`. La clave pública VAPID, en base64url. */
export interface ClaveVapid {
  clavePublica: string;
}

/**
 * Respuesta de `POST /push/probar`. Está pensada para LEERSE en pantalla, no
 * para ramificar lógica: `diagnostico` es una frase en español que dice dónde
 * se rompió la cadena. El backend nunca devuelve el `endpoint` aquí — sigue
 * siendo una capacidad de escritura hacia el teléfono de alguien.
 */
export interface ResultadoPruebaPush {
  /** `false` cuando el servidor no tiene claves VAPID: no puede enviar nada. */
  configurado: boolean;
  /** Aparatos de este usuario registrados en el backend. Cero es el hallazgo. */
  suscripciones: number;
  entregadas: number;
  fallos: { status: string; que: string }[];
  diagnostico: string;
}

/**
 * Cuerpo de `POST /push/suscripciones`. `endpoint`/`p256dh`/`auth` salen de
 * `PushSubscription` (ver `src/lib/pushSubscription.ts` para cómo se
 * codifican). Es un upsert por `endpoint`: volver a mandar la misma
 * suscripción (p. ej. el latido de cada arranque) actualiza `temas`/
 * `etiqueta` en vez de duplicar la fila.
 */
export interface SuscripcionPushInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number | null;
  temas: TemaPush[];
  etiqueta?: string;
}

/**
 * Respuesta de `POST /push/suscripciones` (201). El backend NUNCA devuelve
 * `endpoint`: es el secreto que identifica el dispositivo ante el proveedor
 * push, no hace falta releerlo y exponerlo sería un riesgo gratuito.
 */
export interface SuscripcionPushCreada {
  id: string;
  temas: TemaPush[];
  etiqueta?: string | null;
  creadaEn: string;
  renovadaEn: string;
}

/** Una fila de `GET /push/suscripciones` — tampoco trae `endpoint`. */
export interface SuscripcionPush {
  id: string;
  etiqueta?: string | null;
  agenteUsuario?: string | null;
  temas: TemaPush[];
  creadaEn: string;
  renovadaEn: string;
}

export interface ActualizarSuscripcionPushInput {
  temas?: TemaPush[];
  etiqueta?: string;
}

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

export interface AddComandaItemInput {
  productoId: string;
  cantidad: number;
  nota?: string;
}

/**
 * `POST /comandas`. El pedido nace YA en la cola de despacho, con sus líneas,
 * en una sola transacción: "crear" y "enviar a cocina" son el mismo acto,
 * porque cada envío es una comanda nueva.
 *
 * Por eso `items` es OBLIGATORIO y con al menos uno — una comanda vacía sería
 * un ticket en blanco en la pantalla de cocina, y el backend la rechaza con
 * 400. Ya no hay 409 por "mesa ocupada": la mesa acepta N comandas vivas.
 */
export interface CreateComandaInput {
  /** Default `"mesa"`. `"para_llevar"` exige `mesaId` ausente. */
  tipo?: TipoComanda;
  mesaId?: string;
  comensales?: number;
  /** Atarla a la reserva la deja `sentada` y permite cerrarla al cobrar. */
  reservacionId?: string;
  notas?: string;
  items: AddComandaItemInput[];
  /**
   * Sólo para pintar el resultado sin releer el plano — el backend no lo
   * recibe ni lo devuelve.
   */
  mesaEtiqueta?: string;
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
  // --- Restaurante (configuración del negocio) ---
  /** Sesión de cualquier rol. */
  getRestaurante(): Promise<Restaurante>;
  /** Sólo `administrador`. Devuelve el objeto completo para refrescar el store de una vez. */
  updateRestaurante(input: UpdateRestauranteInput): Promise<Restaurante>;
  /**
   * Sube el logo (jpg/png/webp, **1MB max** — distinto de los 5MB de las
   * fotos de producto) y devuelve su URL pública; guárdala como `logoUrl` en
   * el `updateRestaurante` que sigue. Desacoplado del PATCH, igual que
   * `uploadProductoImagen`. Sólo `administrador`.
   */
  uploadLogo(archivo: File): Promise<UploadImagenResult>;

  // --- Plano: salones, plantillas y mesas ---
  listSalones(): Promise<Salon[]>;
  listPlantillas(salonId: string): Promise<Plantilla[]>;
  getPlantilla(plantillaId: string): Promise<PlantillaDetalle>;
  createPlantilla(salonId: string, input: CreatePlantillaInput): Promise<Plantilla>;
  updatePlantilla(plantillaId: string, input: UpdatePlantillaInput): Promise<Plantilla>;
  deletePlantilla(plantillaId: string): Promise<void>;
  activarPlantilla(plantillaId: string): Promise<ActivarPlantillaResult>;
  /**
   * Las identidades de mesa VIVAS del restaurante (`eliminada_en IS NULL`),
   * estén dibujadas en un plano o no. Es la única forma de ver una mesa que
   * se quitó de todas las distribuciones pero sigue existiendo: su etiqueta
   * continúa ocupada (índice parcial `unique (restaurante_id, lower(etiqueta))
   * where eliminada_en is null`) y sin esta lista el editor no puede saberlo
   * más que por el 409 al intentar crearla.
   */
  listMesas(salonId?: string): Promise<Mesa[]>;
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
  /**
   * "Esta mesa ya no existe" (CONTRACT.md §3.6): borrado lógico de la
   * IDENTIDAD de la mesa. Distinto de `deletePlantillaMesa`, que sólo la
   * quita de un plano concreto — esto libera su etiqueta para siempre y la
   * quita de todas las distribuciones donde estuviera dibujada.
   */
  deleteMesa(mesaId: string): Promise<void>;
  /** Operational state of every table, computed server-side by `v_mesa_estado`. */
  getPlano(salonId: string, plantillaId?: string): Promise<MesaEstado[]>;

  // --- Menú ---
  listCategorias(): Promise<Categoria[]>;
  createCategoria(nombre: string): Promise<Categoria>;
  listProductos(): Promise<Producto[]>;
  /**
   * Uploads a product photo (jpg/png/webp, 5MB max) to the backend's local
   * disk storage and returns its public URL — save it as `imagenUrl` in the
   * `createProducto`/`updateProducto` call that follows. Not coupled to
   * either: the file can be uploaded before the product exists yet.
   */
  uploadProductoImagen(archivo: File): Promise<UploadImagenResult>;
  createProducto(input: CreateProductoInput): Promise<Producto>;
  updateProducto(id: string, input: UpdateProductoInput): Promise<Producto>;
  setProductoDisponibilidad(id: string, disponible: boolean): Promise<Producto>;
  deleteProducto(id: string): Promise<void>;

  // --- Comandas (el PEDIDO) ---
  /** Nace ya encolada, con sus ítems. No existe `POST /comandas/:id/enviar`. */
  createComanda(input: CreateComandaInput): Promise<Comanda>;
  getComanda(id: string): Promise<Comanda>;
  /** Sólo mientras la comanda siga `pendiente`; si no, 409. */
  addComandaItems(comandaId: string, items: AddComandaItemInput[]): Promise<ComandaItem[]>;
  /** Anula UNA línea (deja `canceladoEn`, no borra). Sólo si está `pendiente`. */
  removeComandaItem(comandaId: string, itemId: string, motivo: string): Promise<void>;
  /** La cocina sacó el pedido: sale de la cola pero NO de la cuenta de la mesa. */
  despacharComanda(comandaId: string): Promise<Comanda>;
  anularComanda(comandaId: string, motivo: string): Promise<Comanda>;

  // --- Despacho y cobro ---
  /** Cola del KDS: global, FIFO estricto, por comanda y con las líneas embebidas. */
  getColaDespacho(): Promise<ComandaEnCola[]>;
  /** Mesas con algo ya despachado esperando pago. */
  getCuentasPorCobrar(): Promise<CuentaMesa[]>;
  /** Mismo dato que el anterior filtrado a una mesa, más sus comandas vivas. */
  getCuentaDeMesa(mesaId: string): Promise<CuentaDeMesa>;
  /** Liquida las comandas despachadas de la mesa en UN `Cobro`. */
  cobrarMesa(mesaId: string, input: CobrarMesaInput): Promise<Cobro>;
  /** La factura completa, para reimprimirla. */
  getCobro(cobroId: string): Promise<Cobro>;
  /**
   * Facturas emitidas de un día operativo.
   *
   * Devuelve `null` cuando el backend no sabe contestarlo — hoy es el caso:
   * `CONTRACT.md` sólo define `GET /cobros/:id`, no hay listado por fecha. Las
   * pantallas deben distinguir "hoy no se cobró nada" de "esto no se puede
   * preguntar todavía".
   */
  listCobrosDelDia(fecha: string): Promise<Cobro[] | null>;

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
  /**
   * ⚠️ Ya NO abre una comanda: devuelve sólo la reservación en `sentada`. Una
   * comanda es un pedido y exige al menos una línea, así que la primera la
   * crea el mesero al tomar la nota. La mesa igual queda ocupada desde este
   * instante — `v_mesa_estado` cuenta una reserva sentada como ocupación por
   * sí sola (`sentadaReservacionId`), así que el refresco del plano confirma
   * el estado optimista en vez de pisarlo.
   */
  sentarReservacion(id: string): Promise<Reservacion>;
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
  /**
   * Reporte de ventas por período, resuelto del lado del backend. `periodo`
   * default `'dia'`; `fecha` ausente = día operativo actual (el backend
   * decide hora de corte y zona horaria, ya no hace falta calcularlo aquí).
   */
  getReporteVentas(periodo?: PeriodoReporte, fecha?: string): Promise<ReporteVentas>;

  // --- Web Push ---
  /** La clave pública VAPID para `pushManager.subscribe`. */
  getClaveVapid(): Promise<ClaveVapid>;
  /**
   * `POST /push/probar` — manda un push de prueba a los aparatos del usuario
   * y devuelve en qué paso se rompió la cadena. Es la única forma de
   * distinguir desde el salón entre "nunca me suscribí", "mi service worker
   * es viejo" y "el servidor no puede enviar": los tres se ven igual.
   */
  probarPush(): Promise<ResultadoPruebaPush>;
  /** Upsert por `endpoint` (nunca lo devuelve): crea o renueva la suscripción de este dispositivo. */
  crearSuscripcionPush(input: SuscripcionPushInput): Promise<SuscripcionPushCreada>;
  /** Las suscripciones del restaurante — para una futura pantalla de administración, no usada por el flujo de Despacho. */
  listSuscripcionesPush(): Promise<SuscripcionPush[]>;
  actualizarSuscripcionPush(id: string, input: ActualizarSuscripcionPushInput): Promise<void>;
  /** Por `endpoint`, no por id: es lo único que el navegador conoce al desuscribirse. */
  eliminarSuscripcionPush(endpoint: string): Promise<void>;
}
