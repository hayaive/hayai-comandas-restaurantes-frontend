import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Plus, QrCode } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { PageHero } from "@/components/ui/PageHero";
import { PageBody, Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { useReservationStore, useTodaysReservations } from "@/lib/useReservationStore";
import { RESERVATION_ESTADO_META } from "@/lib/reservationMeta";
import { formatTime } from "@/lib/format";
import { ReservationFormModal } from "@/components/reservaciones/ReservationFormModal";
import { QrCodeModal } from "@/components/reservaciones/QrCodeModal";
import type { Reservacion } from "@/api";

export function ReservacionesPage() {
  const status = useReservationStore((s) => s.status);
  const error = useReservationStore((s) => s.error);
  const load = useReservationStore((s) => s.load);
  const cancel = useReservationStore((s) => s.cancel);
  const confirm = useReservationStore((s) => s.confirm);
  const reservations = useTodaysReservations();

  const [formOpen, setFormOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState<Reservacion | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const canCancel = (r: Reservacion) => r.estado === "pendiente" || r.estado === "confirmada";

  const resumen = useMemo(() => {
    const comensales = reservations.reduce((sum, r) => sum + r.personas, 0);
    const sinMesa = reservations.filter((r) => !r.mesaEtiqueta).length;
    return { comensales, sinMesa };
  }, [reservations]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Reservaciones"
        subtitle="Reservas de hoy"
        actions={
          <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Nueva reserva
          </Button>
        }
      />

      <PageBody>
        <PageHero
          tone="cool"
          eyebrow="Hoy"
          title="Quién viene hoy"
          description="Cada reserva lleva su propio código QR. Compártelo con el cliente para que elija mesa desde su teléfono, o valídalo en la puerta desde Check-in."
          stats={[
            { label: "Reservas", value: reservations.length },
            { label: "Comensales", value: resumen.comensales },
            { label: "Sin mesa", value: resumen.sinMesa },
          ]}
        />

        {status === "loading" && reservations.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando reservaciones…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<CalendarCheck size={26} />}
            title="No se pudieron cargar las reservaciones"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void load()}>Reintentar</Button>}
          />
        )}

        {status === "ready" && reservations.length === 0 && (
          <EmptyState
            icon={<CalendarCheck size={26} />}
            title="No hay reservas hoy"
            description="Crea una reserva y comparte su código QR con el cliente."
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                <Plus size={14} /> Nueva reserva
              </Button>
            }
          />
        )}

        {reservations.length > 0 && (
          <Section title="Agenda del día">
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border bg-surface-sunken text-[11px] uppercase tracking-wide text-fg-subtle">
                    <tr>
                      <th className="px-5 py-3 font-medium">Hora</th>
                      <th className="px-5 py-3 font-medium">Cliente</th>
                      <th className="px-5 py-3 font-medium">Mesa</th>
                      <th className="px-5 py-3 font-medium">Personas</th>
                      <th className="px-5 py-3 font-medium">Estado</th>
                      <th className="px-5 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reservations.map((r) => {
                      const meta = RESERVATION_ESTADO_META[r.estado];
                      return (
                        <tr
                          key={r.id}
                          className="transition-colors duration-150 hover:bg-surface-hover"
                        >
                          <td className="px-5 py-3 font-mono tabular-nums font-medium text-fg">
                            {formatTime(r.iniciaEn)}
                          </td>
                          <td className="px-5 py-3 text-fg">{r.clienteNombre}</td>
                          <td className="px-5 py-3 font-mono tabular-nums text-fg-muted">
                            {r.mesaEtiqueta ?? "Sin asignar"}
                          </td>
                          <td className="px-5 py-3 tabular-nums text-fg-muted">{r.personas}</td>
                          <td className="px-5 py-3">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <IconButton
                                icon={<QrCode size={15} />}
                                label="Ver código QR"
                                variant="outline"
                                size="sm"
                                onClick={() => setQrTarget(r)}
                              />
                              {r.estado === "pendiente" && (
                                <Button size="sm" onClick={() => void confirm(r.id)}>
                                  Confirmar
                                </Button>
                              )}
                              {canCancel(r) && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() =>
                                    void cancel(r.id, "Cancelada desde el panel de reservaciones")
                                  }
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}
      </PageBody>

      <ReservationFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <QrCodeModal reservacion={qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  );
}
