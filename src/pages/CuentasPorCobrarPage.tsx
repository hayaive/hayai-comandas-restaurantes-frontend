import { useEffect, useState } from "react";
import { ChefHat, Clock, RefreshCw, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MotionCard } from "@/components/ui/MotionCard";
import { PageBody, Section, StaggerGrid } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { DualPrice } from "@/components/shared/DualPrice";
import { CobrarMesaModal } from "@/components/facturacion/CobrarMesaModal";
import { useComandaStore } from "@/lib/useComandaStore";
import { formatUsd } from "@/lib/format";
import type { CuentaMesa } from "@/api";

/**
 * Cuentas por cobrar — el menú del cajero: qué mesas deben dinero.
 *
 * Es UNA de las dos entradas al mismo dato (`v_cuenta_mesa`): aquí se listan
 * TODAS las mesas con saldo pendiente; la ficha de una mesa en el plano muestra
 * exactamente lo mismo filtrado a una sola. Por eso las dos abren el mismo
 * `CobrarMesaModal` en vez de tener cada una su propio flujo de cobro.
 *
 * Se listan sólo las mesas con algo YA DESPACHADO (`comandasPorCobrar > 0`):
 * una mesa cuyo pedido sigue en cocina todavía no se puede cobrar. Aun así la
 * tarjeta muestra lo que queda en cocina, porque es la diferencia entre cerrar
 * la mesa y dejarle una cuenta nueva abierta.
 */

/** Mismo ritmo que el plano: una cuenta nueva no es tan urgente como un pedido. */
const POLL_INTERVAL_MS = 15_000;

export function CuentasPorCobrarPage() {
  const cuentas = useComandaStore((s) => s.cuentas);
  const status = useComandaStore((s) => s.cuentasStatus);
  const error = useComandaStore((s) => s.cuentasError);
  const loadCuentas = useComandaStore((s) => s.loadCuentas);
  const [cobrando, setCobrando] = useState<CuentaMesa | null>(null);

  useEffect(() => {
    void loadCuentas();
  }, [loadCuentas]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (useComandaStore.getState().cuentasStatus === "loading") return;
      void loadCuentas();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadCuentas]);

  const totalPendiente = cuentas.reduce((sum, c) => sum + Number(c.totalPorCobrar), 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Cuentas por cobrar"
        subtitle={
          cuentas.length === 0
            ? "Ninguna mesa con saldo pendiente"
            : `${cuentas.length} ${cuentas.length === 1 ? "mesa" : "mesas"} · ${formatUsd(totalPendiente)} por cobrar`
        }
        actions={
          <Button size="sm" onClick={() => void loadCuentas()} disabled={status === "loading"}>
            <RefreshCw size={14} className={status === "loading" ? "animate-spin" : undefined} />
            Actualizar
          </Button>
        }
      />

      <PageBody>
        {status === "loading" && cuentas.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando cuentas…</p>
        )}

        {status === "error" && cuentas.length === 0 && (
          <EmptyState
            icon={<Wallet size={26} />}
            title="No se pudieron cargar las cuentas"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void loadCuentas()}>Reintentar</Button>}
          />
        )}

        {status === "ready" && cuentas.length === 0 && (
          <EmptyState
            icon={<Wallet size={26} />}
            title="Nada por cobrar"
            description="Cuando la cocina despache el pedido de una mesa, su cuenta aparecerá aquí lista para cobrar."
          />
        )}

        {cuentas.length > 0 && (
          <Section title="Mesas con saldo pendiente">
            <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cuentas.map((cuenta) => (
                <MotionCard key={cuenta.mesaId} interactive={false} lift>
                  <CardHeader>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-base font-semibold tabular-nums text-fg">
                        {cuenta.mesaEtiqueta}
                      </span>
                      <Badge tone="reserved">
                        {cuenta.comandasPorCobrar}{" "}
                        {cuenta.comandasPorCobrar === 1 ? "comanda" : "comandas"}
                      </Badge>
                    </div>
                    <span
                      className="flex shrink-0 items-center gap-1 font-mono text-[12px] tabular-nums text-fg-subtle"
                      title="Tiempo desde el primer pedido"
                    >
                      <Clock size={13} />
                      {cuenta.minutosOcupada} min
                    </span>
                  </CardHeader>

                  <CardBody className="flex flex-1 flex-col gap-3">
                    <p className="text-[13px] text-fg-muted">
                      {cuenta.salonNombre ?? "Sin salón"} · {cuenta.comensales}{" "}
                      {cuenta.comensales === 1 ? "comensal" : "comensales"}
                    </p>

                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-fg-muted">Por cobrar</span>
                      <DualPrice
                        usd={cuenta.totalPorCobrar}
                        className="font-mono text-lg font-semibold tabular-nums text-fg"
                      />
                    </div>

                    {cuenta.comandasEnCocina > 0 && (
                      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-fg-muted">
                        <ChefHat size={14} className="mt-0.5 shrink-0" />
                        <span>
                          {cuenta.comandasEnCocina}{" "}
                          {cuenta.comandasEnCocina === 1 ? "comanda" : "comandas"} en cocina por{" "}
                          {formatUsd(cuenta.totalEnCocina)} — no entra en este cobro.
                        </span>
                      </p>
                    )}

                    <Button
                      variant="primary"
                      size="lg"
                      className="mt-auto w-full"
                      onClick={() => setCobrando(cuenta)}
                    >
                      <Wallet size={16} /> Cobrar mesa
                    </Button>
                  </CardBody>
                </MotionCard>
              ))}
            </StaggerGrid>
          </Section>
        )}
      </PageBody>

      <CobrarMesaModal
        open={cobrando !== null}
        mesaId={cobrando?.mesaId ?? null}
        mesaEtiqueta={cobrando?.mesaEtiqueta}
        onClose={() => setCobrando(null)}
      />
    </div>
  );
}
