import { useEffect, useMemo } from "react";
import { RefreshCw, DollarSign, Receipt, TrendingUp, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageBody, Section, StaggerGrid } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
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

  /** Ticket promedio — la cifra que un dueño mira después del total. */
  const ticketPromedio = useMemo(() => {
    if (!totales || totales.numeroComandas === 0) return null;
    return Number(totales.totalVentasUsd) / totales.numeroComandas;
  }, [totales]);

  /** Unidades del producto más vendido, para dimensionar las barras. */
  const maxUnidades = useMemo(
    () => productosVendidos.reduce((max, p) => Math.max(max, p.cantidad), 0),
    [productosVendidos],
  );

  async function handleRefresh() {
    await Promise.all([reload(), loadCobradas(todayIso())]);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Ventas"
        subtitle="Resumen del día operativo actual"
        actions={
          <Button
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={status === "loading"}
          >
            <RefreshCw size={14} className={status === "loading" ? "animate-spin" : undefined} />
            Actualizar
          </Button>
        }
      />

      <PageBody>
        {status === "loading" && !totales && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando reporte del día…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<DollarSign size={26} />}
            title="No se pudo cargar el reporte"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void handleRefresh()}>Reintentar</Button>}
          />
        )}

        {status === "ready" && totales && (
          <>
            <Section title="Resumen">
              <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatTile
                  icon={<DollarSign size={20} />}
                  tone="brand"
                  label="Ventas de hoy"
                  value={formatUsd(totales.totalVentasUsd)}
                  hint={
                    ticketPromedio === null
                      ? undefined
                      : `${formatUsd(ticketPromedio)} por comanda`
                  }
                />
                <StatTile
                  icon={<Receipt size={20} />}
                  tone="free"
                  label="Comandas cobradas"
                  value={totales.numeroComandas}
                  hint={
                    historicoCompleto
                      ? undefined
                      : `${historial.length} visibles en esta sesión`
                  }
                />
                <StatTile
                  icon={<Users size={20} />}
                  tone="reserved"
                  label="Comensales atendidos"
                  value={totales.comensales}
                />
              </StaggerGrid>
            </Section>

            <Section title="Productos más vendidos">
              <Card>
                <CardHeader>
                  <CardTitle>Ranking del día</CardTitle>
                  <Badge tone="accent">unidades e ingreso</Badge>
                </CardHeader>
                <CardBody>
                  {productosVendidos.length === 0 ? (
                    <p className="py-4 text-sm text-fg-muted">
                      Todavía no hay ventas registradas hoy.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {productosVendidos.map((p, i) => (
                        <li key={p.productoId} className="flex items-center gap-3">
                          <span className="w-5 shrink-0 font-mono text-[12px] tabular-nums text-fg-subtle">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {i === 0 && (
                                <TrendingUp size={14} className="shrink-0 text-accent" />
                              )}
                              <span className="truncate text-sm text-fg">{p.nombre}</span>
                            </div>
                            {/* Barra proporcional al más vendido. Es una
                                comparación relativa, no una escala absoluta,
                                así que no lleva eje — la cifra exacta está
                                a la derecha. */}
                            <div
                              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
                              role="presentation"
                            >
                              <div
                                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                                style={{
                                  width: `${maxUnidades === 0 ? 0 : (p.cantidad / maxUnidades) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[13px] tabular-nums text-fg-muted">
                            {p.cantidad} u.
                          </span>
                          <span className="w-20 shrink-0 text-right font-mono text-[13px] tabular-nums font-medium text-fg">
                            {formatUsd(p.ingresoUsd)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </Section>

            <Section title="Histórico de comandas">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {historial.length} {historial.length === 1 ? "comanda" : "comandas"}
                  </CardTitle>
                  <span className="font-mono text-[13px] tabular-nums font-medium text-fg">
                    {formatUsd(totalHistorial)}
                  </span>
                </CardHeader>
                <CardBody className="p-0">
                  {historial.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-fg-muted">
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
                <p className="text-[12px] leading-relaxed text-fg-subtle">
                  El histórico muestra sólo las comandas cobradas en esta sesión: el backend
                  todavía no expone un listado de comandas cerradas (falta algo como{" "}
                  <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[11px]">
                    GET /comandas?estado=cobrada&amp;fecha=
                  </code>
                  ). Las cifras de arriba sí vienen del reporte del día completo.
                </p>
              )}
            </Section>
          </>
        )}
      </PageBody>
    </div>
  );
}
