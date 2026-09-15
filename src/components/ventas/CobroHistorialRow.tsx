import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { Cobro, MetodoPago } from "@/api";
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
 * Una FACTURA del día, plegada por defecto y con todo su detalle al abrirla.
 *
 * Sustituye a `ComandaHistorialRow`: la unidad del histórico de ventas dejó de
 * ser la comanda y pasó a ser el cobro, porque una mesa genera varias comandas
 * y UNA factura. Por eso la fila agrupa las comandas que cubre en vez de
 * listarse una por pedido — si no, una mesa que pidió tres rondas aparecería
 * tres veces y el total del día se contaría mal.
 */
export function CobroHistorialRow({ cobro }: { cobro: Cobro }) {
  const [open, setOpen] = useState(false);
  const detalleId = `historial-${cobro.id}`;
  const mesaEtiqueta = cobro.mesa?.etiqueta ?? cobro.comandas[0]?.mesaEtiqueta ?? "—";
  const items = cobro.comandas.flatMap((comanda) =>
    comanda.items.filter((item) => item.canceladoEn == null),
  );
  const cancelados = cobro.comandas.flatMap((comanda) =>
    comanda.items.filter((item) => item.canceladoEn != null),
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detalleId}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-hover"
      >
        <span className="text-fg-subtle">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="font-mono text-[13px] tabular-nums font-semibold text-fg">
          #{cobro.numeroDia}
        </span>
        <span className="flex-1 truncate text-sm text-fg">
          Mesa {mesaEtiqueta}
          <span className="text-fg-muted">
            {" "}
            · {cobro.comandas.length}{" "}
            {cobro.comandas.length === 1 ? "comanda" : "comandas"}
          </span>
        </span>
        <span className="hidden font-mono text-[12px] text-fg-subtle sm:inline">
          {formatTime(cobro.cobradoEn)}
        </span>
        <span className="hidden text-[12px] text-fg-muted md:inline">
          {items.length} {items.length === 1 ? "ítem" : "ítems"}
        </span>
        <span className="font-mono text-sm tabular-nums font-semibold text-fg">
          {formatUsd(cobro.total)}
        </span>
      </button>

      {open && (
        <div id={detalleId} className="bg-surface-sunken px-5 pb-5 pl-12">
          <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
            <div>
              <dt className="text-fg-subtle">Comensales</dt>
              <dd className="font-mono text-fg">{cobro.comensales}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Cobrada</dt>
              <dd className="font-mono text-fg">{formatTime(cobro.cobradoEn)}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Propina</dt>
              <dd className="font-mono text-fg">{formatUsd(cobro.propina)}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Descuento</dt>
              <dd className="font-mono text-fg">{formatUsd(cobro.descuento)}</dd>
            </div>
          </dl>

          {/* Una sección por comanda: es el desglose que el cliente pide
              cuando pregunta "¿esto qué es?" sobre una cuenta de varias rondas. */}
          {cobro.comandas.map((comanda) => {
            const vivos = comanda.items.filter((item) => item.canceladoEn == null);
            return (
              <div key={comanda.id} className="mb-3">
                <p className="mb-1 text-[12px] font-medium text-fg-muted">
                  Comanda #{comanda.numeroDia}
                  <span className="text-fg-subtle"> · {formatTime(comanda.creadaEn)}</span>
                </p>
                {vivos.length === 0 ? (
                  <p className="text-[13px] text-fg-muted">Sin ítems vivos.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
                    {vivos.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-8 shrink-0 font-mono text-[13px] tabular-nums text-fg-muted">
                          {item.cantidad}×
                        </span>
                        <span className="flex-1 text-sm text-fg">
                          {item.nombreSnap}
                          {item.nota ? <span className="text-fg-subtle"> · {item.nota}</span> : null}
                        </span>
                        <span className="font-mono text-[12px] text-fg-subtle">
                          {formatUsd(item.precioUnitarioSnap)} c/u
                        </span>
                        <span className="w-16 shrink-0 text-right font-mono text-[13px] tabular-nums text-fg">
                          {formatUsd(item.totalLinea)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {cancelados.length > 0 && (
            <p className="mt-2 text-[12px] text-fg-subtle">
              {cancelados.length} {cancelados.length === 1 ? "ítem anulado" : "ítems anulados"} — no
              suman al total.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-fg-subtle">Pagado con</span>
              {cobro.pagos.length > 0 ? (
                cobro.pagos.map((pago) => (
                  <Badge key={pago.id} tone="free">
                    {METODO_LABEL[pago.metodo]} · {formatUsd(pago.montoUsd)}
                    {pago.referencia ? ` · ${pago.referencia}` : ""}
                  </Badge>
                ))
              ) : (
                <span className="text-[12px] text-fg-muted">sin detalle de pago</span>
              )}
            </div>
            <span className={cn("font-mono text-base tabular-nums font-semibold text-fg")}>
              {formatUsd(cobro.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
