import { useEffect, useMemo } from "react";
import { ArrowClockwise, CurrencyDollar, Receipt, TrendUp, Users } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ComandaHistorialRow } from "@/components/ventas/ComandaHistorialRow";
import { useComandaStore } from "@/lib/useComandaStore";
import { todayIso, useSalesReport } from "@/lib/useSalesReport";
import { formatUsd } from "@/lib/format";

export function VentasPage() {
  const { status, error, totales, productosVendidos, reload } = useSalesReport();
  const cobradasHoy = useComandaStore((s) => s.cobradasHoy);
  const historicoCompleto = useComandaStore((s) => s.historicoCompleto);
  const loadCobradas = useComandaStore((s) => s.loadCobradas);

  useEffect(() => {
    void loadCobradas(todayIso());
  }, [loadCobradas]);

  const historial = useMemo(
    () =>
      [...cobradasHoy].sort((a, b) =>
        (b.cerradaEn ?? b.abiertaEn).localeCompare(a.cerradaEn ?? a.abiertaEn),
      ),
    [cobradasHoy],
  );

  // Con el histórico incompleto (el backend no lo expone), los totales del
  // reporte siguen siendo la cifra buena: la lista de abajo es sólo lo visible.
  const totalHistorial = useMemo(
    () => historial.reduce((sum, c) => sum + Number(c.total), 0),
    [historial],
  );

  async function handleRefresh() {
    await Promise.all([reload(), loadCobradas(todayIso())]);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[16px] font-semibold text-fg">Ventas</h1>
          <p className="text-[12px] text-fg-muted">Resumen del día operativo actual</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={status === "loading"}
        >
          <ArrowClockwise size={14} className={status === "loading" ? "animate-spin" : undefined} />
          Actualizar
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {status === "loading" && !totales && (
          <p className="py-10 text-center text-[13px] text-fg-muted">Cargando reporte del día…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<CurrencyDollar size={26} weight="duotone" />}
            title="No se pudo cargar el reporte"
            description={error ?? "Ocurrió un error inesperado."}
            action={
              <Button variant="secondary" size="sm" onClick={() => void handleRefresh()}>
                Reintentar
              </Button>
            }
          />
        )}

        {status === "ready" && totales && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <CardBody className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
                    <CurrencyDollar size={22} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-[12px] text-fg-muted">Ventas de hoy</p>
                    <p className="font-mono text-[24px] font-semibold text-fg">
                      {formatUsd(totales.totalVentasUsd)}
                    </p>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-status-free-soft text-status-free-fg">
                    <Receipt size={22} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-[12px] text-fg-muted">Comandas cobradas</p>
                    <p className="font-mono text-[24px] font-semibold text-fg">
                      {totales.numeroComandas}
                    </p>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-status-reserved-soft text-status-reserved-fg">
                    <Users size={22} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-[12px] text-fg-muted">Comensales atendidos</p>
                    <p className="font-mono text-[24px] font-semibold text-fg">
                      {totales.comensales}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <span className="text-[13px] font-semibold text-fg">
                  Productos más vendidos del día
                </span>
                <Badge tone="accent">unidades e ingreso</Badge>
              </CardHeader>
              <CardBody>
                {productosVendidos.length === 0 ? (
                  <p className="text-[13px] text-fg-muted">
                    Todavía no hay ventas registradas hoy.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {productosVendidos.map((p, i) => (
                      <li key={p.productoId} className="flex items-center gap-3 py-2">
                        <span className="w-5 shrink-0 font-mono text-[12px] text-fg-subtle">
                          {i + 1}
                        </span>
                        <span className="flex flex-1 items-center gap-2 truncate text-[13px] text-fg">
                          {i === 0 && <TrendUp size={14} className="shrink-0 text-accent" />}
                          {p.nombre}
                        </span>
                        <span className="font-mono text-[13px] text-fg-muted">{p.cantidad} u.</span>
                        <span className="w-20 shrink-0 text-right font-mono text-[13px] text-fg">
                          {formatUsd(p.ingresoUsd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <span className="text-[13px] font-semibold text-fg">Histórico de comandas</span>
                <span className="font-mono text-[12px] text-fg-subtle">
                  {historial.length} {historial.length === 1 ? "comanda" : "comandas"} ·{" "}
                  {formatUsd(totalHistorial)}
                </span>
              </CardHeader>
              <CardBody className="p-0">
                {historial.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-fg-muted">
                    {historicoCompleto
                      ? "Todavía no se ha cobrado ninguna comanda hoy."
                      : "Aún no has cobrado ninguna comanda en esta sesión."}
                  </p>
                ) : (
                  <div>
                    {historial.map((comanda) => (
                      <ComandaHistorialRow key={comanda.id} comanda={comanda} />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {!historicoCompleto && (
              <p className="text-[11px] text-fg-subtle">
                El histórico muestra sólo las comandas cobradas en esta sesión: el backend todavía
                no expone un listado de comandas cerradas (falta algo como{" "}
                <code className="font-mono">GET /comandas?estado=cobrada&amp;fecha=</code>). Las
                cifras de arriba sí vienen del reporte del día completo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
