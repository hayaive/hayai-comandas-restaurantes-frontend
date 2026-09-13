import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Armchair, CheckCircle2, Users } from "lucide-react";
import { m } from "framer-motion";

import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconTile } from "@/components/ui/IconTile";
import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useActiveTemplate } from "@/lib/useFloorPlanStore";
import { useReservationStore } from "@/lib/useReservationStore";
import { useAppMotion } from "@/lib/useAppMotion";
import { cn } from "@/lib/cn";
import { api, ApiError } from "@/api";
import type { Reservacion } from "@/api";

type LoadState = "loading" | "not-found" | "ready" | "assigned" | "error";

/**
 * Public, customer-facing "auto-selección" view — opened from the QR link on
 * a confirmed reservation that has no table assigned yet. No sidebar, no
 * staff chrome: this is meant to be opened on a guest's own phone.
 *
 * It is the only screen a *customer* ever sees, so it carries the full brand
 * treatment (ambient field, brand mark, gradient tiles) rather than the
 * denser operational styling of the staff screens. The table buttons are
 * deliberately large and widely spaced — this is a one-handed, standing,
 * possibly-outdoors interaction.
 *
 * The chosen table gets the brown active fill, same as everywhere else.
 */
export function SelfSeatPage() {
  const { codigoPublico = "" } = useParams<{ codigoPublico: string }>();
  const activeTemplate = useActiveTemplate();
  const assignTable = useReservationStore((s) => s.assignTable);
  const motionPrefs = useAppMotion();

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
    <div className="relative flex min-h-dvh w-full flex-col items-center overflow-hidden bg-bg px-4 py-8 text-fg">
      <div className="ambient-field" aria-hidden="true" />

      <div className="relative z-10 mb-8 flex w-full max-w-lg items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={44} />
          <div className="min-w-0">
            <span className="block truncate text-base font-semibold leading-tight text-fg">
              Coffee &amp; Cake
            </span>
            <span className="block truncate text-[12px] text-fg-muted">
              para amantes del café
            </span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <m.div
        variants={motionPrefs.rise}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-lg"
      >
        {state === "loading" && (
          <Card>
            <CardBody className="py-12 text-center text-sm text-fg-muted">
              Buscando tu reserva…
            </CardBody>
          </Card>
        )}

        {state === "not-found" && (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <IconTile tone="danger" size="xl">
                <AlertTriangle size={26} />
              </IconTile>
              <p className="text-lg font-semibold text-fg">No encontramos esa reserva</p>
              <p className="max-w-[34ch] text-sm text-fg-muted">
                Revisa el enlace o contacta al restaurante.
              </p>
            </CardBody>
          </Card>
        )}

        {state === "error" && (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <IconTile tone="danger" size="xl">
                <AlertTriangle size={26} />
              </IconTile>
              <p className="max-w-[34ch] text-sm text-danger">
                Ocurrió un error al buscar tu reserva. Intenta de nuevo.
              </p>
            </CardBody>
          </Card>
        )}

        {(state === "ready" || state === "assigned") && reservacion && (
          <Card className="shadow-[var(--shadow-token-md)]">
            <CardBody className="flex flex-col gap-6">
              <div>
                <p className="text-sm text-fg-muted">Hola,</p>
                <h1 className="text-2xl font-semibold leading-tight text-fg">
                  {reservacion.clienteNombre}
                </h1>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-fg-muted">
                  <Users size={15} /> {reservacion.personas} personas
                </p>
              </div>

              {state === "assigned" ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-status-free/40 bg-status-free-soft px-4 py-6 text-center">
                  <IconTile tone="free" size="lg">
                    <CheckCircle2 size={24} />
                  </IconTile>
                  <p className="flex flex-wrap items-center justify-center gap-2 text-base font-medium text-status-free-fg">
                    Tu mesa es
                    <Badge tone="free" className="font-mono text-sm tabular-nums">
                      {reservacion.mesaEtiqueta}
                    </Badge>
                  </p>
                  <p className="text-[12px] text-status-free-fg/80">
                    Muestra este enlace o el código{" "}
                    <span className="font-mono font-semibold">{reservacion.codigoCorto}</span> al
                    llegar.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm font-medium text-fg">
                    Elige tu mesa en {activeTemplate.name}
                  </p>
                  {availableTables.length === 0 ? (
                    <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
                      No hay mesas disponibles en este momento. El restaurante te asignará una al
                      llegar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {availableTables.map((table) => {
                        const isSelecting = selecting === table.id;
                        return (
                          <button
                            key={table.id}
                            type="button"
                            disabled={selecting !== null}
                            onClick={() => void handleSelect(table.id, table.label)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-4 text-center",
                              "transition-colors duration-150",
                              "disabled:pointer-events-none disabled:opacity-60",
                              isSelecting
                                ? "border-transparent bg-active text-active-fg"
                                : "border-border bg-surface-raised hover:border-active hover:bg-active-soft",
                            )}
                          >
                            <Armchair
                              size={22}
                              className={isSelecting ? "text-active-fg" : "text-fg-muted"}
                            />
                            <span
                              className={cn(
                                "font-mono text-base font-semibold tabular-nums",
                                isSelecting ? "text-active-fg" : "text-fg",
                              )}
                            >
                              {table.label}
                            </span>
                            <span
                              className={cn(
                                "text-[11px]",
                                isSelecting ? "text-active-fg/80" : "text-fg-subtle",
                              )}
                            >
                              {table.seats} sillas
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {error && (
                    <p role="alert" className="mt-3 text-[12px] font-medium text-danger">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </m.div>
    </div>
  );
}
