import { formatDateTime, formatPrecioCobro, formatTasaValor, formatTime, formatUsd } from "@/lib/format";
import { rasterizar, Ticket } from "@/lib/escpos";
import type { MostrarPreciosEn } from "@/api";
import type { FacturaMesaData, FacturaPaperWidth } from "./FacturaMesaTicket";

/**
 * Montos ya formateados del ticket. Lo comparten la vista HTML
 * (`FacturaMesaTicket`) y el ticket ESC/POS de abajo para que las dos
 * impresiones no diverjan.
 */
export function facturaMontos(data: FacturaMesaData) {
  const totalBsFmt = formatBsAmount(data.totalBs);
  const vista = data.mostrarPreciosEn ?? "ambas";

  /**
   * Cada línea del ticket, en la vista de precios configurada
   * (`mostrarPreciosEn`). Usa `formatPrecioCobro` — no `formatPrecioVivo` —
   * porque la conversión aquí SIEMPRE va con `data.tasaValor`, la tasa
   * CONGELADA en el cobro, no la vigente de hoy: reimprimir una factura vieja
   * tiene que dar exactamente las mismas cifras que el día que se cobró (ver
   * la nota grande en `src/lib/format.ts`). Sin tasa registrada ese día,
   * `formatPrecioCobro` ya degrada solo a USD en vez de repetir "tasa no
   * disponible" en cada renglón.
   */
  const money = (usd: string | number): string => formatPrecioCobro(usd, vista, data.tasaValor);

  /**
   * La fila de TOTAL es la única que NO pasa por `money()`: usa
   * `data.totalBs`, ya calculado y congelado por el backend al cobrar, en vez
   * de convertir `data.total` aquí (que podría quedar a un céntimo de
   * distancia por redondeo). Por eso necesita su propia versión de la
   * degradación sin tasa, para decidir si esa fila se imprime en Bs o cae a
   * USD.
   */
  const vistaTotalEfectiva: MostrarPreciosEn =
    (vista === "bs" || vista === "ambas") && !data.tasaValor ? "usd" : vista;
  const totalPrincipal =
    vistaTotalEfectiva === "usd" ? formatUsd(data.total) : (totalBsFmt ?? formatUsd(data.total));
  // La referencia en dólares (y la nota de tasa) sólo se imprime en vista
  // "ambas": es justo la que promete mostrar las dos monedas. En "usd" no hay
  // bolívares que referenciar, y en "bs" el dueño pidió explícitamente sólo
  // bolívares — imprimir un monto en USD ahí, aunque sea "de referencia",
  // sería colar la moneda que pidió no mostrar.
  const mostrarReferenciaUsd = vistaTotalEfectiva === "ambas" && Boolean(data.tasaValor);

  return {
    money,
    totalPrincipal,
    mostrarReferenciaUsd,
    descuento: withValue(data.descuento),
    impuesto: withValue(data.impuesto),
    propina: withValue(data.propina),
  };
}

/**
 * La misma factura que `FacturaMesaTicket`, en bytes ESC/POS para mandarla
 * directo a la térmica (`imprimirTermica`). El logo y la taza van como
 * imagen de 1 bit; si alguna no carga, el ticket sale igual sin ella.
 */
export async function facturaEscPos(
  data: FacturaMesaData,
  paperWidth: FacturaPaperWidth,
): Promise<Uint8Array<ArrayBuffer>> {
  const [logo, taza] = await Promise.all([
    rasterizar("/logo-mono.png", LOGO_PUNTOS).catch(() => null),
    rasterizar(TAZA_SVG, TAZA_PUNTOS).catch(() => null),
  ]);
  const { money, totalPrincipal, mostrarReferenciaUsd, descuento, impuesto, propina } =
    facturaMontos(data);
  const variasComandas = data.comandas.length > 1;
  const t = new Ticket(paperWidth === "80mm" ? 48 : 32);

  t.align("center");
  if (logo) t.image(logo);
  t.bold(true).tall(true).text(data.restauranteNombre.toUpperCase()).tall(false).bold(false);
  if (data.restauranteRif) t.text(data.restauranteRif);
  t.align("left").sep();
  t.align("center").bold(true).text("FACTURA DE COBRO").bold(false).align("left");
  t.row("Mesa", data.mesaEtiqueta);
  t.row("Cliente", data.clienteNombre ?? "Consumidor final");
  if (data.comensales != null) t.row("Comensales", String(data.comensales));
  t.row("Fecha", formatDateTime(data.cerradaEn ?? new Date().toISOString()));
  t.sep();

  data.comandas.forEach((comanda, index) => {
    if (variasComandas) {
      t.bold(true)
        .row(`COMANDA ${comanda.numeroDia != null ? `#${comanda.numeroDia}` : ""}`, formatTime(comanda.abiertaEn))
        .bold(false);
    }
    if (comanda.meseroNombre) t.text(`Mesero: ${comanda.meseroNombre}`);
    if (comanda.items.length === 0) t.text("Sin ítems.");
    for (const item of comanda.items) {
      t.text(item.nombreSnap.toUpperCase());
      if (item.nota) t.text(`* ${item.nota}`);
      t.row(`${formatCantidad(item.cantidad)} x ${money(item.precioUnitarioSnap)}`, money(item.totalLinea));
    }
    if (variasComandas && index < data.comandas.length - 1) t.sep(".");
  });

  t.sep();
  t.row("Subtotal", money(data.subtotal));
  if (descuento) t.row("Descuento", `-${money(descuento)}`);
  if (impuesto) t.row("Impuesto", money(impuesto));
  if (propina) t.row("Propina", money(propina));
  t.sep();
  t.bold(true).tall(true).row("TOTAL", totalPrincipal).tall(false).bold(false);
  if (mostrarReferenciaUsd) {
    t.align("right").text(`(${formatUsd(data.total)})`).align("left");
    t.text(`Tasa del día: ${formatTasaValor(data.tasaValor)}`);
  }
  t.sep();
  t.align("center").bold(true).text(data.mensajeFooter ?? "¡Gracias por su visita!").bold(false);
  if (taza) t.image(taza);

  return t.bytes();
}

/** Tamaños en puntos (8 = 1mm): el logo ~18mm, la taza ~6mm, como en pantalla. */
const LOGO_PUNTOS = 144;
const TAZA_PUNTOS = 48;

/** El ícono `Coffee` de lucide (el mismo del ticket en pantalla), como SVG suelto. */
const TAZA_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/>' +
      '<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>' +
      "</svg>",
  );

/** `undefined`/`null`/"0" se tratan igual: la línea no se imprime. */
function withValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? value : null;
}

/** Ya viene calculado y congelado por el backend — sólo se formatea para imprimir. */
function formatBsAmount(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** `ComandaItem.cantidad` es `Decimal(14,3)` en el backend — hasta 3
 * decimales para ítems que se venden por peso, sin redondear de más. */
export function formatCantidad(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}
