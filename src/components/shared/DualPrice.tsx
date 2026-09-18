import { useTasaStore } from "@/lib/useTasaStore";
import { useRestauranteStore } from "@/lib/useRestauranteStore";
import { formatUsd, formatBsEquivalent, formatPrecioVivo } from "@/lib/format";

export interface DualPriceProps {
  /** USD, decimal-as-string per contract (or a plain number for already-computed totals). */
  usd: string | number;
  className?: string;
}

/**
 * Precio en la vista configurada por el dueño (`Restaurante.mostrarPreciosEn`
 * — "usd" | "bs" | "ambas"), a la tasa BCV VIGENTE: esta es una cuenta
 * potencialmente viva, no un `Cobro` ya emitido, así que usa
 * `formatPrecioVivo` — NUNCA `formatPrecioCobro`, que es para el ticket ya
 * congelado (ver la nota en `src/lib/format.ts`).
 *
 * El caso "ambas" (el default, y el que la app ya mostraba antes de que
 * existiera esta preferencia) se resuelve aparte en vez de por
 * `formatPrecioVivo` para conservar el estilo de dos tonos (USD normal, Bs
 * atenuado) — `formatPrecioVivo` devuelve un solo string plano, perfecto para
 * "usd"/"bs" pero no para ese tratamiento visual de dos colores.
 */
export function DualPrice({ usd, className }: DualPriceProps) {
  const tasaUsdValor = useTasaStore((s) => s.vigente?.usd?.valor ?? null);
  const vista = useRestauranteStore((s) => s.restaurante?.mostrarPreciosEn ?? "ambas");

  if (vista === "ambas") {
    return (
      <span className={className}>
        {formatUsd(usd)}
        <span className="text-fg-subtle"> · {formatBsEquivalent(usd, tasaUsdValor)}</span>
      </span>
    );
  }

  return <span className={className}>{formatPrecioVivo(usd, vista, tasaUsdValor)}</span>;
}
