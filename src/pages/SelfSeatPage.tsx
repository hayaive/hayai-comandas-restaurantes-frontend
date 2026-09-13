import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Armchair, CheckCircle, Users, Warning } from "@phosphor-icons/react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useActiveTemplate } from "@/lib/useFloorPlanStore";
import { useReservationStore } from "@/lib/useReservationStore";
import { api, ApiError } from "@/api";
import type { Reservacion } from "@/api";

type LoadState = "loading" | "not-found" | "ready" | "assigned" | "error";

/**
 * Public, customer-facing "auto-selección" view — opened from the QR link on
 * a confirmed reservation that has no table assigned yet. No sidebar, no
 * staff chrome: this is meant to be opened on a guest's own phone.
 */
export function SelfSeatPage() {
  const { codigoPublico = "" } = useParams<{ codigoPublico: string }>();
  const activeTemplate = useActiveTemplate();
  const assignTable = useReservationStore((s) => s.assignTable);

  const [state, setState] = useState<LoadState>("loading");
  const [reservacion, setReservacion] = useState<Reservacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const found = await api.buscarReservacionPorCodigo(codigoPublico);
        if (cancelled) return;
        if (!found) {
          setState("not-found");
          return;
        }
        setReservacion(found);
        setState(found.mesaId ? "assigned" : "ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [codigoPublico]);

  const availableTables = activeTemplate.tables.filter((t) => t.status === "free");

  async function handleSelect(mesaId: string, mesaLabel: string) {
    setSelecting(mesaId);
    setError(null);
    try {
      const updated = await assignTable(codigoPublico, mesaId, mesaLabel);
      setReservacion(updated);
      setState("assigned");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo asignar la mesa");
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center bg-bg px-4 py-8 text-fg">
      <div className="mb-8 flex w-full max-w-lg items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <div>
            <span className="block text-[14px] font-semibold uppercase tracking-wide text-fg">
              Coffee &amp; Cake
            </span>
            <span className="block text-[11px] text-fg-muted">para amantes del café</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg">
        {state === "loading" && (
          <Card>
            <CardBody className="py-10 text-center text-[13px] text-fg-muted">
              Buscando tu reserva…
            </CardBody>
          </Card>
        )}

        {state === "not-found" && (
          <Card>
            <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
              <Warning size={26} className="text-danger" weight="duotone" />
              <p className="text-[14px] font-semibold text-fg">No encontramos esa reserva</p>
              <p className="text-[13px] text-fg-muted">
                Revisa el enlace o contacta al restaurante.
              </p>
            </CardBody>
          </Card>
        )}

        {state === "error" && (
          <Card>
            <CardBody className="py-10 text-center text-[13px] text-danger">
              Ocurrió un error al buscar tu reserva. Intenta de nuevo.
            </CardBody>
          </Card>
        )}

        {(state === "ready" || state === "assigned") && reservacion && (
          <Card>
            <CardBody className="flex flex-col gap-5 py-6">
              <div>
                <p className="text-[12px] text-fg-muted">Hola,</p>
                <h1 className="text-[18px] font-semibold text-fg">{reservacion.clienteNombre}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-muted">
                  <Users size={15} /> {reservacion.personas} personas
                </p>
              </div>

              {state === "assigned" ? (
                <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-status-free bg-status-free-soft px-4 py-5 text-center">
                  <CheckCircle size={24} weight="fill" className="text-status-free-fg" />
                  <p className="text-[14px] font-medium text-status-free-fg">
                    Tu mesa es <Badge tone="free">{reservacion.mesaEtiqueta}</Badge>
                  </p>
                  <p className="text-[12px] text-status-free-fg/80">
                    Muestra este enlace o el código {reservacion.codigoCorto} al llegar.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-fg">
                    Elige tu mesa en {activeTemplate.name}
                  </p>
                  {availableTables.length === 0 ? (
                    <p className="text-[13px] text-fg-muted">
                      No hay mesas disponibles en este momento. El restaurante te asignará una al
                      llegar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {availableTables.map((table) => (
                        <button
                          key={table.id}
                          type="button"
                          disabled={selecting !== null}
                          onClick={() => void handleSelect(table.id, table.label)}
                          className="flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3 py-3 text-center transition-colors duration-150 hover:border-accent hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-60"
                        >
                          <Armchair size={20} className="text-fg-muted" weight="duotone" />
                          <span className="font-mono text-[14px] font-semibold text-fg">
                            {table.label}
                          </span>
                          <span className="text-[11px] text-fg-subtle">{table.seats} sillas</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
