import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { Comanda, MetodoPago } from "@/api";
import { formatTime, formatUsd } from "@/lib/format";

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo_usd: "Efectivo USD",
  efectivo_bs: "Efectivo Bs",
  pago_movil: "Pago móvil",
  transferencia: "Transferencia",
  punto: "Punto de venta",
  binance: "Binance",
  otro: "Otro",
};

/**
 * Una comanda cobrada del día, plegada por defecto y con TODO su detalle al
 * abrirla: ítems con cantidad y precio congelado, comensales, horas de apertura
 * y cierre, propina y con qué se pagó.
 */
export function ComandaHistorialRow({ comanda }: { comanda: Comanda }) {
  const [open, setOpen] = useState(false);
  const items = comanda.items.filter((item) => item.estado !== "cancelado");
  const cancelados = comanda.items.filter((item) => item.estado === "cancelado");
  const detalleId = `historial-${comanda.id}`;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detalleId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-hover"
      >
        <span className="text-fg-subtle">
          {open ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
        </span>
        <span className="font-mono text-[13px] font-semibold text-fg">
          {comanda.numeroDia != null ? `#${comanda.numeroDia}` : "—"}
        </span>
        <span className="flex-1 truncate text-[13px] text-fg">
          Mesa {comanda.mesaEtiqueta || "—"}
          {comanda.clienteNombre ? (
            <span className="text-fg-muted"> · {comanda.clienteNombre}</span>
          ) : null}
        </span>
        <span className="hidden font-mono text-[12px] text-fg-subtle sm:inline">
          {formatTime(comanda.abiertaEn)}
          {comanda.cerradaEn ? ` → ${formatTime(comanda.cerradaEn)}` : ""}
        </span>
        <span className="hidden text-[12px] text-fg-muted md:inline">
          {items.length} {items.length === 1 ? "ítem" : "ítems"}
        </span>
        <span className="font-mono text-[14px] font-semibold text-fg">
          {formatUsd(comanda.total)}
        </span>
      </button>

      {open && (
        <div id={detalleId} className="bg-surface px-4 pb-4 pl-11">
          <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
            <div>
              <dt className="text-fg-subtle">Comensales</dt>
              <dd className="font-mono text-fg">{comanda.comensales}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Abierta</dt>
              <dd className="font-mono text-fg">{formatTime(comanda.abiertaEn)}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Cerrada</dt>
              <dd className="font-mono text-fg">
                {comanda.cerradaEn ? formatTime(comanda.cerradaEn) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Propina</dt>
              <dd className="font-mono text-fg">{formatUsd(comanda.propina ?? "0")}</dd>
            </div>
          </dl>

          {items.length === 0 ? (
            <p className="text-[13px] text-fg-muted">Esta comanda se cerró sin ítems.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-sm)] border border-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-8 shrink-0 font-mono text-[13px] text-fg-muted">
                    {item.cantidad}×
                  </span>
                  <span className="flex-1 text-[13px] text-fg">
                    {item.nombreSnap}
                    {item.nota ? <span className="text-fg-subtle"> · {item.nota}</span> : null}
                  </span>
                  <span className="font-mono text-[12px] text-fg-subtle">
                    {formatUsd(item.precioUnitarioSnap)} c/u
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[13px] text-fg">
                    {formatUsd(item.totalLinea)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {cancelados.length > 0 && (
            <p className="mt-2 text-[12px] text-fg-subtle">
              {cancelados.length} {cancelados.length === 1 ? "ítem cancelado" : "ítems cancelados"} —
              no suman al total.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-fg-subtle">Pagado con</span>
              {comanda.pagos && comanda.pagos.length > 0 ? (
                comanda.pagos.map((pago) => (
                  <Badge key={pago.id} tone="free">
                    {METODO_LABEL[pago.metodo]} · {formatUsd(pago.montoUsd)}
                    {pago.referencia ? ` · ${pago.referencia}` : ""}
                  </Badge>
                ))
              ) : (
                <span className="text-[12px] text-fg-muted">sin detalle de pago</span>
              )}
            </div>
            <span className={cn("font-mono text-[15px] font-semibold text-fg")}>
              {formatUsd(comanda.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
