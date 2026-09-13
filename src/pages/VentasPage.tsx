import { CurrencyDollar, Receipt, TrendUp } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSalesReport } from "@/lib/useSalesReport";
import { formatUsd } from "@/lib/format";

export function VentasPage() {
  const { status, error, totales, masVendidoPorCantidad, masVendidoPorIngreso } = useSalesReport();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-[16px] font-semibold text-fg">Ventas</h1>
        <p className="text-[12px] text-fg-muted">Resumen del día operativo actual</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {status === "loading" && (
          <p className="py-10 text-center text-[13px] text-fg-muted">Cargando reporte del día…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<CurrencyDollar size={26} weight="duotone" />}
            title="No se pudo cargar el reporte"
            description={error ?? "Ocurrió un error inesperado."}
          />
        )}

        {status === "ready" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardBody className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
                    <CurrencyDollar size={22} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-[12px] text-fg-muted">Ventas de hoy</p>
                    <p className="font-mono text-[24px] font-semibold text-fg">
                      {formatUsd(totales?.totalVentasUsd ?? "0")}
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
                      {totales?.numeroComandas ?? 0}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <span className="text-[13px] font-semibold text-fg">Más vendido por cantidad</span>
                  <Badge tone="accent">unidades</Badge>
                </CardHeader>
                <CardBody>
                  {masVendidoPorCantidad.length === 0 ? (
                    <p className="text-[13px] text-fg-muted">Todavía no hay ventas registradas hoy.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border">
                      {masVendidoPorCantidad.map((p, i) => (
                        <li key={p.productoId} className="flex items-center justify-between py-2">
                          <span className="flex items-center gap-2 text-[13px] text-fg">
                            {i === 0 && <TrendUp size={14} className="text-accent" />}
                            {p.nombre}
                          </span>
                          <span className="font-mono text-[13px] text-fg-muted">{p.cantidad} u.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <span className="text-[13px] font-semibold text-fg">Más vendido por ingreso</span>
                  <Badge tone="free">USD</Badge>
                </CardHeader>
                <CardBody>
                  {masVendidoPorIngreso.length === 0 ? (
                    <p className="text-[13px] text-fg-muted">Todavía no hay ventas registradas hoy.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border">
                      {masVendidoPorIngreso.map((p, i) => (
                        <li key={p.productoId} className="flex items-center justify-between py-2">
                          <span className="flex items-center gap-2 text-[13px] text-fg">
                            {i === 0 && <TrendUp size={14} className="text-status-free-fg" />}
                            {p.nombre}
                          </span>
                          <span className="font-mono text-[13px] text-fg-muted">
                            {formatUsd(p.ingresoUsd)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
            <p className="text-[11px] text-fg-subtle">
              "Producto más vendido" tiene dos respuestas distintas — por cantidad y por ingreso — y
              ambas se muestran por separado, tal como especifica el contrato de datos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
