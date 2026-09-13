/** Shared formatting helpers — money is always a wire `string`, parsed here only for display. */

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
