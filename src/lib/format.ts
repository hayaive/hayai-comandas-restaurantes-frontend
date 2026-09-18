/** Shared formatting helpers — money is always a wire `string`, parsed here only for display. */

import type { MostrarPreciosEn } from "@/api/types";

export function formatUsd(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `$${n.toFixed(2)}`;
}

/**
 * Equivalente en bolívares de un monto en USD, a la tasa BCV vigente
 * (`usd.valor` de `GET /tasa/vigente`). Devuelve un texto explícito en vez de
 * omitir en silencio cuando no hay tasa registrada todavía — nunca asumas
 * que `tasaValorUsd` viene con valor.
 */
export function formatBsEquivalent(
  usdValue: string | number,
  tasaValorUsd: string | null | undefined,
): string {
  if (!tasaValorUsd) return "tasa no disponible";
  const usd = typeof usdValue === "string" ? Number(usdValue) : usdValue;
  const tasa = Number(tasaValorUsd);
  if (!Number.isFinite(usd) || !Number.isFinite(tasa)) return "tasa no disponible";
  const bs = usd * tasa;
  return `Bs ${bs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * ---------------------------------------------------------------------
 * `formatPrecioVivo` / `formatPrecioCobro` — DOS FUNCIONES A PROPÓSITO
 * ---------------------------------------------------------------------
 * `Restaurante.mostrarPreciosEn` decide en qué moneda se DIBUJA un precio
 * ("usd" | "bs" | "ambas"), pero DÓNDE sale esa cifra depende de si la cuenta
 * ya se cobró:
 *
 *   - Una cuenta VIVA (sin cobrar) se convierte con la tasa VIGENTE: es una
 *     estimación que se mueve si la tasa cambia antes de que la mesa pague.
 *   - Un `Cobro` YA EMITIDO usa `cobro.totalBs`/`cobro.tasaValor`,
 *     CONGELADOS al momento de cobrar. Reimprimir una factura de septiembre
 *     en octubre tiene que dar el mismo monto que el cliente pagó — eso es
 *     un bug de dinero, no de estética.
 *
 * Por eso NO existe un `formatPrecio(monto, vista, tasa)` único: un flag
 * "¿esto es un cobro congelado?" es justo el tipo de parámetro que alguien
 * olvida pasar en un cambio futuro. Con dos funciones de nombre distinto, el
 * propio código en el sitio de la llamada dice cuál tasa está usando.
 * `formatPrecioVivo` la usa `DualPrice` (pantallas con cuentas sin cobrar);
 * `formatPrecioCobro` la usa `FacturaMesaTicket` (el ticket ya cobrado) — no
 * mezclar.
 */

/**
 * Precio de una cuenta VIVA (sin cobrar todavía), en la vista de precios
 * configurada, a la tasa VIGENTE. Ver la nota de arriba: nunca para un
 * `Cobro` ya emitido.
 *
 * Sin tasa vigente, la vista "bs" degrada a "usd" en vez de imprimir "tasa no
 * disponible" como si fuera el precio real (diseño §7.5); "ambas" no
 * necesita degradar porque ya convive con la ausencia de tasa mostrando el
 * aviso al lado del monto en dólares.
 */
export function formatPrecioVivo(
  usd: string | number,
  vista: MostrarPreciosEn,
  tasaVigenteUsd: string | null | undefined,
): string {
  const vistaEfectiva = vista === "bs" && !tasaVigenteUsd ? "usd" : vista;
  return formatPorVista(usd, vistaEfectiva, tasaVigenteUsd);
}

/**
 * Precio de un `Cobro` YA EMITIDO, en la vista de precios configurada, a la
 * tasa CONGELADA de ese cobro (`cobro.tasaValor`) — JAMÁS la vigente de hoy.
 * Ver la nota de arriba.
 *
 * El ticket imprime línea por línea: sin tasa congelada (el restaurante no
 * tenía tasa registrada el día que cobró), tanto "bs" como "ambas" degradan a
 * "usd" para no repetir "tasa no disponible" en cada renglón — el USD
 * original es lo único honesto que se puede imprimir ahí.
 */
export function formatPrecioCobro(
  usd: string | number,
  vista: MostrarPreciosEn,
  tasaCongeladaUsd: string | null | undefined,
): string {
  const vistaEfectiva = (vista === "bs" || vista === "ambas") && !tasaCongeladaUsd ? "usd" : vista;
  return formatPorVista(usd, vistaEfectiva, tasaCongeladaUsd);
}

function formatPorVista(
  usd: string | number,
  vista: MostrarPreciosEn,
  tasaUsd: string | null | undefined,
): string {
  if (vista === "usd") return formatUsd(usd);
  if (vista === "bs") return formatBsEquivalent(usd, tasaUsd);
  return `${formatUsd(usd)} · ${formatBsEquivalent(usd, tasaUsd)}`;
}

/** Un valor de tasa (Bs por unidad de divisa) formateado para el widget de tasas. */
export function formatTasaValor(valor: string | null | undefined): string {
  if (!valor) return "sin registrar";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "sin registrar";
  return `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The public self-seat link encoded in a reservation's QR code. */
export function selfSeatUrl(codigoPublico: string): string {
  return `${window.location.origin}/reservar/${codigoPublico}`;
}
