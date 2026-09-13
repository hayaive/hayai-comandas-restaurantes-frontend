/** Shared formatting helpers — money is always a wire `string`, parsed here only for display. */

export function formatUsd(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `$${n.toFixed(2)}`;
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
