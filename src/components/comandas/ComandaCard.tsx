import { useState } from "react";
import { BellRing, Check, Clock, User, X } from "lucide-react";

import { CardBody, CardHeader } from "@/components/ui/Card";
import { MotionCard } from "@/components/ui/MotionCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ApiError } from "@/api";
import type { ComandaEnCola } from "@/api";
import { DESTINO_META } from "@/lib/comandaMeta";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { DualPrice } from "@/components/shared/DualPrice";
import { useComandaStore } from "@/lib/useComandaStore";

/**
 * Un pedido esperando en la cola de despacho — la tarjeta del KDS.
 *
 * Lo que esta tarjeta YA NO hace, y por qué:
 *
 * - **No cobra.** El cobro dejó de ser por comanda: se cobra la MESA entera
 *   (`POST /mesas/:mesaId/cobrar`), y eso vive en "Cuentas por cobrar" y en la
 *   ficha de la mesa. Un pedido suelto ya no es una cuenta.
 * - **No tiene estado por ítem.** El workflow
 *   `pendiente → en preparación → servido` desapareció: la cocina despacha la
 *   comanda entera. Lo único que se le puede hacer a una línea es anularla, y
 *   sólo mientras el pedido no haya salido.
 * - **No agrega ítems.** Añadir a un pedido que ya está en la cola rompería el
 *   FIFO; una ronda más es una comanda nueva, que se toma desde Mesero.
 *
 * Despachar la saca de la cola pero NO la borra: queda viva en la cuenta
 * cobrable de su mesa.
 */

/** A partir de este rato en cola, la tarjeta se marca como atrasada. */
const MINUTOS_ATRASO = 15;

export function ComandaCard({ comanda }: { comanda: ComandaEnCola }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const despachar = useComandaStore((s) => s.despachar);
  const anularItem = useComandaStore((s) => s.anularItem);

  const atrasada = comanda.minutosEnCola >= MINUTOS_ATRASO;
  const vivos = comanda.items.filter((item) => !item.cancelado);

  async function ejecutar(accion: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await accion();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionCard interactive={false} lift>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-base font-semibold tabular-nums text-fg">
            {comanda.tipo === "para_llevar"
              ? "Para llevar"
              : (comanda.mesaEtiqueta ?? "Sin mesa")}
          </span>
          <Badge tone="neutral">#{comanda.numeroDia}</Badge>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 font-mono text-[12px] tabular-nums",
            atrasada ? "font-semibold text-danger" : "text-fg-subtle",
          )}
          // El reloj de la tarjeta es el dato operativo de la pantalla: cuánto
          // lleva esperando este pedido, no a qué hora entró.
          title={`Entró a las ${formatTime(comanda.creadaEn)}`}
        >
          <Clock size={13} />
          {comanda.minutosEnCola} min
        </span>
      </CardHeader>

      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
          <User size={15} className="shrink-0" />
          <span className="truncate">{comanda.meseroNombre ?? "Sin mesero asignado"}</span>
          <span className="shrink-0 text-fg-subtle">· {comanda.comensales} pers.</span>
        </div>

        {comanda.notas && (
          <p className="rounded-[var(--radius-md)] border border-status-reserved/40 bg-status-reserved-soft px-3 py-2 text-[12px] leading-relaxed text-status-reserved-fg">
            {comanda.notas}
          </p>
        )}

        {comanda.items.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-5 text-center text-sm text-fg-subtle">
            Sin ítems
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {comanda.items.map((item) => {
              const destino = DESTINO_META[item.destino];
              return (
                <li key={item.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        // Los cancelados se quedan a la vista, tachados: la
                        // cocina tiene que ver que algo se anuló por si ya lo
                        // había empezado.
                        item.cancelado ? "text-fg-subtle line-through" : "text-fg",
                      )}
                    >
                      {item.cantidad}× {item.nombre}
                    </p>
                    {item.nota && (
                      <p className="truncate text-[11px] text-fg-subtle">* {item.nota}</p>
                    )}
                  </div>
                  {destino && (
                    <Badge tone={destino.tone} className="shrink-0">
                      {destino.label}
                    </Badge>
                  )}
                  {item.cancelado ? (
                    <Badge tone="neutral" className="shrink-0">
                      Anulado
                    </Badge>
                  ) : (
                    <IconButton
                      icon={<X size={13} />}
                      label={`Anular ${item.nombre}`}
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void ejecutar(
                          () =>
                            anularItem(
                              comanda.comandaId,
                              item.id,
                              "Anulado desde la cola de despacho",
                            ),
                          "No se pudo anular el ítem",
                        )
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-medium text-fg-muted">
            {vivos.length} {vivos.length === 1 ? "ítem" : "ítems"}
          </span>
          <DualPrice
            usd={comanda.total}
            className="font-mono text-base font-semibold tabular-nums text-fg"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger"
          >
            {error}
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() =>
            void ejecutar(
              () => despachar(comanda.comandaId),
              "No se pudo despachar la comanda",
            )
          }
        >
          {busy ? <BellRing size={16} /> : <Check size={16} />}
          {busy ? "Despachando…" : "Despachar"}
        </Button>
      </CardBody>
    </MotionCard>
  );
}
