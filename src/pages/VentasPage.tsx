import { useEffect, useMemo, useState } from "react";
import { RefreshCw, DollarSign, Receipt, TrendingDown, TrendingUp, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageBody, Section, StaggerGrid } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives/tabs";
import { CobroHistorialRow } from "@/components/ventas/CobroHistorialRow";
import { useComandaStore } from "@/lib/useComandaStore";
import { todayIso, useSalesReport } from "@/lib/useSalesReport";
import { formatUsd } from "@/lib/format";
import type { GranularidadSerie, PeriodoReporte, ReporteVentas, VentaPunto } from "@/api";

export function VentasPage() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>("dia");
  const { status, error, reporte, productosVendidos, reload } = useSalesReport(periodo);
  const cobrosDelDia = useComandaStore((s) => s.cobrosDelDia);
  const historicoCompleto = useComandaStore((s) => s.historicoCompleto);
  const loadCobrosDelDia = useComandaStore((s) => s.loadCobrosDelDia);

  useEffect(() => {
    void loadCobrosDelDia(todayIso());
  }, [loadCobrosDelDia]);

  const historial = useMemo(
    () => [...cobrosDelDia].sort((a, b) => b.cobradoEn.localeCompare(a.cobradoEn)),
    [cobrosDelDia],
  );

  // Con el histórico incompleto (el backend no lo expone), los totales del
  // reporte siguen siendo la cifra buena: la lista de abajo es sólo lo visible.
  const totalHistorial = useMemo(
    () => historial.reduce((sum, c) => sum + Number(c.total), 0),
    [historial],
  );

  /** Unidades del producto más vendido, para dimensionar las barras. */
  const maxUnidades = useMemo(
    () => productosVendidos.reduce((max, p) => Math.max(max, p.cantidad), 0),
    [productosVendidos],
  );

  /** Punto más alto de la serie del período, para dimensionar sus barras. */
  const maxSerieUsd = useMemo(
    () => (reporte ? reporte.serie.reduce((max, p) => Math.max(max, Number(p.totalUsd)), 0) : 0),
    [reporte],
  );

  const deltaPct = reporte ? pctDelta(reporte.total.totalUsd, reporte.comparacion.total.totalUsd) : null;

  async function handleRefresh() {
    await Promise.all([reload(), loadCobrosDelDia(todayIso())]);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Ventas"
        subtitle="Resumen del período seleccionado"
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
        {status === "loading" && !reporte && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando reporte…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<DollarSign size={26} />}
            title="No se pudo cargar el reporte"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void handleRefresh()}>Reintentar</Button>}
          />
        )}

        {status === "ready" && reporte && (
          <>
            <Section
              title="Resumen"
              action={
                <Tabs
                  value={periodo}
                  onValueChange={(value) => setPeriodo(value as PeriodoReporte)}
                >
                  <TabsList>
                    <TabsTrigger value="dia">Día</TabsTrigger>
                    <TabsTrigger value="mes">Mes</TabsTrigger>
                    <TabsTrigger value="anio">Año</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            >
              <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  icon={<DollarSign size={20} />}
                  tone="brand"
                  label={labelTotal(periodo)}
                  value={formatUsd(reporte.total.totalUsd)}
                  hint={`${formatUsd(reporte.total.ticketPromedioUsd)} por cuenta`}
                />
                <StatTile
                  icon={
                    deltaPct !== null && deltaPct < 0 ? (
                      <TrendingDown size={20} />
                    ) : (
                      <TrendingUp size={20} />
                    )
                  }
                  tone={deltaPct !== null && deltaPct < 0 ? "danger" : "free"}
                  label={etiquetaComparacion(reporte)}
                  value={formatUsd(reporte.comparacion.total.totalUsd)}
                  hint={deltaPct === null ? undefined : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`}
                />
                <StatTile
                  icon={<Receipt size={20} />}
                  tone="neutral"
                  // Facturas emitidas = mesas atendidas. Ya NO son comandas:
                  // una mesa genera varias y una sola cuenta, así que contar
                  // comandas dejó de responder "cuántas mesas vendimos".
                  label="Cuentas"
                  value={reporte.total.cobros}
                  hint={
                    periodo !== "dia" || historicoCompleto
                      ? undefined
                      : `${historial.length} visibles en esta sesión`
                  }
                />
                <StatTile
                  icon={<Users size={20} />}
                  tone="reserved"
                  label="Comensales"
                  value={reporte.total.comensales}
                />
              </StaggerGrid>

              {reporte.enCurso && (
                <p className="text-[12px] leading-relaxed text-fg-subtle">
                  {periodo === "dia"
                    ? "El día operativo sigue en curso — la cifra todavía se está moviendo."
                    : "Este tramo sigue en curso — se compara contra lo transcurrido del período anterior, no contra su total completo."}
                </p>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>{tituloSerie(periodo)}</CardTitle>
                  <Badge tone="accent">{formatUsd(reporte.total.totalUsd)} en total</Badge>
                </CardHeader>
                <CardBody className={reporte.serie.length > 8 ? "max-h-[320px] overflow-y-auto" : undefined}>
                  {reporte.serie.every((p) => Number(p.totalUsd) === 0) ? (
                    <p className="py-4 text-sm text-fg-muted">
                      Todavía no hay ventas registradas en este tramo.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {reporte.serie.map((punto) => (
                        <li key={punto.clave} className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-[12px] text-fg-muted">
                            {claveSerieLabel(punto, reporte.granularidad)}
                          </span>
                          <div
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                              style={{
                                width: `${maxSerieUsd === 0 ? 0 : (Number(punto.totalUsd) / maxSerieUsd) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-right font-mono text-[13px] tabular-nums font-medium text-fg">
                            {formatUsd(punto.totalUsd)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
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

            <Section title="Cuentas cobradas">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {historial.length} {historial.length === 1 ? "cuenta" : "cuentas"}
                  </CardTitle>
                  <span className="font-mono text-[13px] tabular-nums font-medium text-fg">
                    {formatUsd(totalHistorial)}
                  </span>
                </CardHeader>
                <CardBody className="p-0">
                  {historial.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-fg-muted">
                      {historicoCompleto
                        ? "Todavía no se ha cobrado ninguna cuenta hoy."
                        : "Aún no has cobrado ninguna cuenta en esta sesión."}
                    </p>
                  ) : (
                    <div>
                      {historial.map((cobro) => (
                        <CobroHistorialRow key={cobro.id} cobro={cobro} />
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              {!historicoCompleto && (
                <p className="text-[12px] leading-relaxed text-fg-subtle">
                  El histórico muestra sólo las cuentas cobradas en esta sesión: el backend
                  todavía no expone un listado de facturas por día (falta algo como{" "}
                  <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[11px]">
                    GET /cobros?fecha=
                  </code>
                  , hoy sólo existe <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[11px]">GET /cobros/:id</code>).
                  Las cifras de arriba sí vienen del reporte del período.
                </p>
              )}
            </Section>
          </>
        )}
      </PageBody>
    </div>
  );
}

/** Variación porcentual del total actual contra el de la comparación. `null` si no se puede calcular. */
function pctDelta(actualUsd: string, anteriorUsd: string): number | null {
  const actual = Number(actualUsd);
  const anterior = Number(anteriorUsd);
  if (!Number.isFinite(actual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function mesDe(fechaIso: string): string {
  const mes = Number(fechaIso.slice(5, 7)) - 1;
  return MESES[mes] ?? fechaIso;
}

function anioDe(fechaIso: string): string {
  return fechaIso.slice(0, 4);
}

function labelTotal(periodo: PeriodoReporte): string {
  if (periodo === "dia") return "Ventas de hoy";
  if (periodo === "mes") return "Ventas del mes";
  return "Ventas del año";
}

function tituloSerie(periodo: PeriodoReporte): string {
  if (periodo === "dia") return "Ventas por turno";
  if (periodo === "mes") return "Ventas por día";
  return "Ventas por mes";
}

/**
 * Etiqueta de la comparación, en consecuencia de `enCurso`: contra el mismo
 * tramo transcurrido si el período consultado sigue abierto, contra el
 * período anterior completo si ya cerró — nunca se asume una cosa fija.
 */
function etiquetaComparacion(reporte: ReporteVentas): string {
  const { periodo, enCurso, comparacion } = reporte;
  if (periodo === "dia") {
    const fecha = new Date(`${comparacion.desde}T00:00:00`);
    return `vs. ${fecha.toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}`;
  }
  if (periodo === "mes") {
    const mes = mesDe(comparacion.desde);
    return enCurso ? `vs. mismo tramo de ${mes}` : `vs. ${mes} completo`;
  }
  const anio = anioDe(comparacion.desde);
  return enCurso ? `vs. mismo tramo de ${anio}` : `vs. ${anio} completo`;
}

const NOMBRES_TURNO: Record<string, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  madrugada: "Madrugada",
};

/** Etiqueta corta de un punto de la serie, según su granularidad. */
function claveSerieLabel(punto: VentaPunto, granularidad: GranularidadSerie): string {
  if (granularidad === "turno") return NOMBRES_TURNO[punto.clave] ?? punto.clave;
  if (granularidad === "dia") return String(Number(punto.clave.slice(-2)));
  return MESES_CORTOS[Number(punto.clave.slice(5, 7)) - 1] ?? punto.clave;
}
