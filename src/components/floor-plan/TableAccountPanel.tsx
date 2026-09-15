import { useEffect, useState } from "react";
import { ChefHat, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DualPrice } from "@/components/shared/DualPrice";
import { CobrarMesaModal } from "@/components/facturacion/CobrarMesaModal";
import { useComandaStore } from "@/lib/useComandaStore";
import { formatTime, formatUsd } from "@/lib/format";

/**
 * La cuenta de una mesa ocupada, dentro de la ficha de la mesa.
 *
 * Es la SEGUNDA entrada al mismo feature que la pantalla de "Cuentas por
 * cobrar": el mismo `GET /mesas/:mesaId/cuenta` y el mismo `CobrarMesaModal`,
 * sólo que filtrado a esta mesa. Un cajero cobra desde la lista; un mesero
 * cobra tocando la mesa en el plano.
 *
 * Muestra el detalle POR COMANDA y no sólo el total porque en el modelo nuevo
 * una mesa acumula varias rondas, y "¿esto ya salió o sigue en cocina?" es la
 * pregunta que decide si se puede cobrar.
 */
export function TableAccountPanel({
  mesaId,
  mesaEtiqueta,
  clienteNombre,
}: {
  mesaId: string;
  mesaEtiqueta: string;
  clienteNombre?: string | null;
}) {
  const cuentaPorMesa = useComandaStore((s) => s.cuentaPorMesa);
  const cuentaMesaStatus = useComandaStore((s) => s.cuentaMesaStatus);
  const loadCuentaDeMesa = useComandaStore((s) => s.loadCuentaDeMesa);
  const [cobrando, setCobrando] = useState(false);

  useEffect(() => {
    void loadCuentaDeMesa(mesaId);
  }, [mesaId, loadCuentaDeMesa]);

  const detalle = cuentaPorMesa[mesaId];
  const status = cuentaMesaStatus[mesaId];
  const cuenta = detalle?.cuenta ?? null;

  if (!detalle && status === "loading") {
    return <p className="text-[13px] text-fg-muted">Cargando la cuenta…</p>;
  }

  if (status === "error" && !detalle) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-danger">No se pudo cargar la cuenta de esta mesa.</p>
        <Button size="sm" onClick={() => void loadCuentaDeMesa(mesaId)}>
          Reintentar
        </Button>
      </div>
    );
  }

  // 200 con `cuenta: null` es una respuesta válida: la mesa no debe nada. Puede
  // pasar en una mesa "ocupada" por una reserva sentada que todavía no pidió.
  if (!cuenta || detalle.comandas.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-4 text-center text-[13px] text-fg-subtle">
        Esta mesa todavía no tiene ningún pedido.
      </p>
    );
  }

  const comandasCobrables = detalle.comandas.filter((c) => c.despachadaEn != null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="occupied">
          {cuenta.comandas} {cuenta.comandas === 1 ? "comanda" : "comandas"}
        </Badge>
        {cuenta.comandasEnCocina > 0 && (
          <Badge tone="reserved">{cuenta.comandasEnCocina} en cocina</Badge>
        )}
        <span className="ml-auto font-mono text-[12px] tabular-nums text-fg-subtle">
          {cuenta.minutosOcupada} min
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-md)] border border-border">
        {detalle.comandas.map((comanda) => {
          const vivos = comanda.items.filter((item) => item.canceladoEn == null);
          return (
            <li key={comanda.id} className="flex flex-col gap-1 px-3 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[13px] tabular-nums font-semibold text-fg">
                  #{comanda.numeroDia}
                </span>
                <Badge tone={comanda.despachadaEn ? "free" : "reserved"}>
                  {comanda.despachadaEn ? "Despachada" : "En cocina"}
                </Badge>
                <span className="ml-auto font-mono text-[13px] tabular-nums text-fg">
                  {formatUsd(comanda.total)}
                </span>
              </div>
              <p className="text-[11px] text-fg-subtle">{formatTime(comanda.creadaEn)}</p>
              <ul className="flex flex-col gap-0.5">
                {vivos.map((item) => (
                  <li key={item.id} className="text-[12px] text-fg-muted">
                    {item.cantidad}× {item.nombreSnap}
                    {item.nota ? <span className="text-fg-subtle"> · {item.nota}</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-[13px] font-medium text-fg-muted">Cuenta total</span>
        <DualPrice
          usd={cuenta.cuentaTotal}
          className="font-mono text-base font-semibold tabular-nums text-fg"
        />
      </div>

      {comandasCobrables.length === 0 ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-fg-muted">
          <ChefHat size={14} className="mt-0.5 shrink-0" />
          <span>
            Todo sigue en cocina. Una comanda sólo se puede cobrar después de despacharla desde la
            pantalla de despacho.
          </span>
        </p>
      ) : (
        <Button variant="primary" className="w-full" onClick={() => setCobrando(true)}>
          <Wallet size={15} /> Cobrar {formatUsd(cuenta.totalPorCobrar)}
        </Button>
      )}

      <CobrarMesaModal
        open={cobrando}
        mesaId={mesaId}
        mesaEtiqueta={mesaEtiqueta}
        clienteNombre={clienteNombre}
        onClose={() => setCobrando(false)}
      />
    </div>
  );
}
