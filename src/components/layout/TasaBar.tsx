import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useTasaStore } from "@/lib/useTasaStore";
import { formatDateTime, formatTasaValor } from "@/lib/format";
import type { TasaDivisa } from "@/api";

/**
 * Franja fija con la tasa BCV (USD) y Euro vigentes, visible desde cualquier
 * pantalla de staff — el mesero la necesita todo el tiempo, no sólo al
 * cobrar. Patrón tomado de karelys-pedidos (banda inferior + panel de
 * detalle). Tras el rediseño vive sobre la misma superficie translúcida que
 * el resto del chrome, no sobre el kraft del rail anterior.
 */
export function TasaBar() {
  const vigente = useTasaStore((s) => s.vigente);
  const status = useTasaStore((s) => s.status);
  const refreshing = useTasaStore((s) => s.refreshing);
  const error = useTasaStore((s) => s.error);
  const load = useTasaStore((s) => s.load);
  const actualizar = useTasaStore((s) => s.actualizar);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-bg/85 px-3 py-2 backdrop-blur-md sm:px-6">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex shrink-0 items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1 text-left transition-colors duration-150 hover:bg-surface-hover"
        >
          <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px]">
            <span className="font-semibold text-fg">BCV</span>
            <span className="text-fg-muted">{formatTasaValor(vigente?.usd?.valor)}</span>
          </span>
          <span className="h-3 w-px shrink-0 bg-border" aria-hidden="true" />
          <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px]">
            <span className="font-semibold text-fg">EUR</span>
            <span className="text-fg-muted">{formatTasaValor(vigente?.eur?.valor)}</span>
          </span>
        </button>

        <span className="ml-auto shrink-0 whitespace-nowrap text-[10.5px] text-fg-muted">
          {vigente ? `Vigente ${vigente.fecha}` : status === "loading" ? "Cargando tasa…" : ""}
        </span>

        <IconButton
          size="sm"
          icon={<RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />}
          label="Actualizar tasa"
          onClick={() => void actualizar()}
          disabled={refreshing}
        />
      </div>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Tasa de cambio"
        description="BCV (USD) y Euro vigentes para este restaurante."
      >
        <div className="flex flex-col gap-3">
          {error && (
            <p className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          )}
          <DetalleTasa label="Dólar (BCV)" tasa={vigente?.usd ?? null} />
          <DetalleTasa label="Euro" tasa={vigente?.eur ?? null} />
          <Button
            variant="primary"
            size="sm"
            className="self-start"
            onClick={() => void actualizar()}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
            {refreshing ? "Actualizando…" : "Actualizar ahora"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function DetalleTasa({ label, tasa }: { label: string; tasa: TasaDivisa | null }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-raised px-4 py-3">
      <p className="text-[12px] font-medium text-fg-muted">{label}</p>
      {tasa ? (
        <>
          <p className="font-mono text-xl font-semibold tabular-nums text-fg">{formatTasaValor(tasa.valor)}</p>
          <p className="text-[11px] text-fg-subtle">
            Fuente: {tasa.fuente} · Registrada {formatDateTime(tasa.creadaEn)}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-fg-subtle">No hay tasa registrada todavía.</p>
      )}
    </div>
  );
}
