import { useTasaStore } from "@/lib/useTasaStore";
import { formatUsd, formatBsEquivalent } from "@/lib/format";

export interface DualPriceProps {
  /** USD, decimal-as-string per contract (or a plain number for already-computed totals). */
  usd: string | number;
  className?: string;
}

/**
 * Precio en USD con su equivalente en bolívares al lado, a la tasa BCV
 * vigente: `$12.50 · Bs 10,406.10`. Si el restaurante todavía no registró una
 * tasa USD (`usd.getTasaVigente().usd === null`), omite el cálculo y dice
 * "tasa no disponible" en vez de romper la pantalla o inventar un valor.
 */
export function DualPrice({ usd, className }: DualPriceProps) {
  const tasaUsdValor = useTasaStore((s) => s.vigente?.usd?.valor ?? null);
  return (
    <span className={className}>
      {formatUsd(usd)}
      <span className="text-fg-subtle"> · {formatBsEquivalent(usd, tasaUsdValor)}</span>
    </span>
  );
}
