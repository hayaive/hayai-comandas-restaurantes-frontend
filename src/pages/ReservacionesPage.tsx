import { useEffect, useState } from "react";
import { CalendarCheck, Plus, QrCode } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
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

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {status === "loading" && reservations.length === 0 && (
          <p className="py-10 text-center text-[13px] text-fg-muted">Cargando reservaciones…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<CalendarCheck size={26} weight="duotone" />}
            title="No se pudieron cargar las reservaciones"
            description={error ?? "Ocurrió un error inesperado."}
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        )}

        {status === "ready" && reservations.length === 0 && (
          <EmptyState
            icon={<CalendarCheck size={26} weight="duotone" />}
            title="No hay reservas hoy"
            description="Crea una reserva y comparte su código QR con el cliente."
            action={
              <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
                <Plus size={14} /> Nueva reserva
              </Button>
            }
          />
        )}

        {reservations.length > 0 && (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-hover text-[11px] uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Hora</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Mesa</th>
                  <th className="px-4 py-2.5 font-medium">Personas</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {reservations.map((r) => {
                  const meta = RESERVATION_ESTADO_META[r.estado];
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-fg">{formatTime(r.iniciaEn)}</td>
                      <td className="px-4 py-3 text-fg">{r.clienteNombre}</td>
                      <td className="px-4 py-3 font-mono text-fg-muted">
                        {r.mesaEtiqueta ?? "Sin asignar"}
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{r.personas}</td>
                      <td className="px-4 py-3">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton
                            icon={<QrCode size={15} />}
                            label="Ver código QR"
                            size="sm"
                            onClick={() => setQrTarget(r)}
                          />
                          {r.estado === "pendiente" && (
                            <Button variant="secondary" size="sm" onClick={() => void confirm(r.id)}>
                              Confirmar
                            </Button>
                          )}
                          {canCancel(r) && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void cancel(r.id, "Cancelada desde el panel de reservaciones")}
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
        )}
      </div>

      <ReservationFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <QrCodeModal reservacion={qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  );
}
