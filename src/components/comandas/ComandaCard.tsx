import { useState } from "react";
import { Ban, BellRing, Check, Clock, User, X } from "lucide-react";

import { CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
 *
 * ## Escala tipográfica (pedido del dueño, sep-2026)
 *
 * Esta tarjeta se lee de pie, a uno o dos metros, con las manos ocupadas y en
 * plena hora pico — no es una tabla de escritorio. Por eso se sale a
 * propósito de la escala "Operate" por defecto de `DESIGN.md` (que asume
 * lectura de cerca y densidad) sólo en esta tarjeta:
 *
 * - **Cantidad** en su propia "columna" (chip aparte, `text-xl`/`2xl` mono
 *   bold): es lo primero que el cocinero necesita leer, antes que el nombre.
 * - **Nombre del ítem** a `text-lg`/`xl` (antes `text-sm`) y sin `truncate`:
 *   nunca se corta.
 * - **Nota de ítem y nota general** son la información que, si se pierde,
 *   sale mal el plato — van en un chip de color (mismo tono `reserved` que
 *   ya usaba la nota general) para que destaquen del nombre, y tampoco
 *   truncan.
 * - **Mesa** sube a la escala "Large display" del sistema
 *   (`text-2xl sm:text-3xl font-semibold`, la misma clase que ya usa el
 *   logo de Login) porque es lo primero que busca el cocinero.
 * - El **reloj de atraso** deja de ser sólo texto rojo y pasa a chip
 *   (fondo + borde `danger-soft`) para que "atrasado" se note sin tener que
 *   leer el número.
 */

/** A partir de este rato en cola, la tarjeta se marca como atrasada. */
const MINUTOS_ATRASO = 15;

export function ComandaCard({ comanda }: { comanda: ComandaEnCola }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const despachar = useComandaStore((s) => s.despachar);
  const anularItem = useComandaStore((s) => s.anularItem);
  const anularComanda = useComandaStore((s) => s.anularComanda);
  /**
   * Qué confirmación está abierta. Anular es IRREVERSIBLE —el backend marca
   * `cancelado_en` y no expone forma de volver atrás— y esta tarjeta se toca
   * en un tablet compartido, en cocina, con las manos ocupadas: un roce que
   * borre el plato de un cliente no se puede deshacer.
   */
  const [confirmando, setConfirmando] = useState<
    { tipo: "item"; id: string; nombre: string } | { tipo: "comanda" } | null
  >(null);

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
      {/* `flex-wrap` a propósito: la mesa ahora es mucho más grande y, junto
          con el número de comanda y el chip de minutos, no siempre entra en
          una sola línea en un teléfono angosto — que baje de línea es mejor
          que truncar o achicar lo primero que busca el cocinero. */}
      <CardHeader className="flex-wrap gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          {/* Mesa / Para llevar: lo más visible de la tarjeta (pedido
              explícito del dueño), a la escala "Large display" del sistema —
              la misma que usa el logo del login. */}
          {/* `break-words` y NO `truncate`: es lo que el cocinero busca primero,
              y a este tamaño "Barra exterior 3" o "Para llevar" se cortarían con
              "…" en un teléfono. Mejor que baje de línea. */}
          <span className="break-words font-mono text-2xl font-semibold tracking-tight tabular-nums text-fg sm:text-3xl">
            {comanda.tipo === "para_llevar"
              ? "Para llevar"
              : (comanda.mesaEtiqueta ?? "Sin mesa")}
          </span>
          <Badge tone="neutral" className="shrink-0 px-2.5 py-1 text-sm font-semibold">
            #{comanda.numeroDia}
          </Badge>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 font-mono text-sm font-semibold tabular-nums sm:text-base",
            // El chip rojo (no sólo texto rojo) es lo que hace que "atrasado"
            // se note de un vistazo, sin tener que leer el número de minutos.
            atrasada
              ? "border border-danger/30 bg-danger-soft text-danger"
              : "text-fg-subtle",
          )}
          // El reloj de la tarjeta es el dato operativo de la pantalla: cuánto
          // lleva esperando este pedido, no a qué hora entró.
          title={`Entró a las ${formatTime(comanda.creadaEn)}`}
        >
          <Clock size={16} />
          {comanda.minutosEnCola} min
        </span>
      </CardHeader>

      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
          <User size={15} className="shrink-0" />
          {/* Sin truncate: el nombre del mesero no es tan crítico como el de
              un plato, pero no hay razón para cortarlo cuando puede bajar de
              línea sin costo. */}
          <span className="break-words">{comanda.meseroNombre ?? "Sin mesero asignado"}</span>
          <span className="shrink-0 text-fg-subtle">· {comanda.comensales} pers.</span>
        </div>

        {comanda.notas && (
          <p className="break-words rounded-[var(--radius-md)] border border-status-reserved/40 bg-status-reserved-soft px-3.5 py-2.5 text-sm font-semibold leading-relaxed text-status-reserved-fg sm:text-base">
            {comanda.notas}
          </p>
        )}

        {comanda.items.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-5 text-center text-sm text-fg-subtle">
            Sin ítems
          </p>
        ) : (
          // Tipo lista, no párrafo: cada ítem es una fila con tres columnas
          // fijas (cantidad / plato+nota / destino+acción) en vez de una
          // cadena "3× Nombre" corrida — así se escanea de un vistazo, no se
          // lee palabra por palabra.
          <ul className="flex flex-col divide-y divide-border">
            {comanda.items.map((item) => {
              const destino = DESTINO_META[item.destino];
              return (
                <li key={item.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                  {/* Columna de cantidad: separada y destacada a propósito —
                      en cocina se lee primero "cuántos" y después "qué es". */}
                  <span
                    className={cn(
                      "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border px-2 font-mono text-xl font-bold tabular-nums sm:text-2xl",
                      item.cancelado
                        ? "border-border bg-surface-hover text-fg-subtle"
                        : "border-accent/25 bg-accent-soft text-accent",
                    )}
                    aria-hidden="true"
                  >
                    {item.cantidad}×
                  </span>

                  <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                    <p
                      className={cn(
                        "break-words text-lg font-semibold leading-snug sm:text-xl",
                        // Los cancelados se quedan a la vista, tachados: la
                        // cocina tiene que ver que algo se anuló por si ya lo
                        // había empezado.
                        item.cancelado ? "text-fg-subtle line-through" : "text-fg",
                      )}
                    >
                      <span className="sr-only">{item.cantidad} </span>
                      {item.nombre}
                    </p>
                    {item.nota && (
                      // La nota es justo lo que no se puede perder ("sin
                      // cebolla", "alérgico al maní"): chip de color, nunca
                      // truncada, en vez de una línea gris a 11px.
                      <p
                        className={cn(
                          "break-words rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-sm font-semibold leading-snug sm:text-base",
                          item.cancelado
                            ? "border-border bg-surface-hover text-fg-subtle line-through"
                            : "border-status-reserved/40 bg-status-reserved-soft text-status-reserved-fg",
                        )}
                      >
                        {item.nota}
                      </p>
                    )}
                  </div>

                  {/* Columna de destino + acción: la misma cola la miran
                      cocina y barra, así que el destino tiene que verse tan
                      bien como la cantidad, no ir metido como texto chico. */}
                  <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                    {destino && (
                      <Badge
                        tone={destino.tone}
                        className={cn(
                          "px-3 py-1.5 text-sm font-semibold",
                          item.cancelado && "opacity-60",
                        )}
                      >
                        {destino.label}
                      </Badge>
                    )}
                    {item.cancelado ? (
                      <Badge tone="neutral" className="px-3 py-1.5 text-sm font-semibold">
                        Anulado
                      </Badge>
                    ) : (
                      <IconButton
                        icon={<X size={16} />}
                        label={`Anular ${item.nombre}`}
                        variant="danger"
                        size="md"
                        disabled={busy}
                        onClick={() =>
                          setConfirmando({ tipo: "item", id: item.id, nombre: item.nombre })
                        }
                      />
                    )}
                  </div>
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

        <div className="flex flex-col gap-2">
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
          {/* Secundario y discreto a propósito: cancelar el pedido entero es lo
              raro, y en un tablet de cocina no puede competir en peso visual
              con "Despachar", que es lo que se toca cien veces por turno. */}
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => setConfirmando({ tipo: "comanda" })}
          >
            <Ban size={14} /> Cancelar pedido
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={confirmando !== null}
        onClose={() => setConfirmando(null)}
        busy={busy}
        title={confirmando?.tipo === "comanda" ? "Cancelar el pedido" : "Anular el ítem"}
        description={
          confirmando?.tipo === "comanda"
            ? `Se anula la comanda #${comanda.numeroDia} completa y sale de la cola. No se puede deshacer.`
            : `Se anula «${confirmando?.tipo === "item" ? confirmando.nombre : ""}» del pedido. No se puede deshacer.`
        }
        confirmLabel={confirmando?.tipo === "comanda" ? "Cancelar pedido" : "Anular ítem"}
        motivoLabel="Motivo"
        motivoPorDefecto={
          confirmando?.tipo === "comanda"
            ? "Cancelado desde la cola de despacho"
            : "Anulado desde la cola de despacho"
        }
        onConfirm={async (motivo) => {
          const objetivo = confirmando;
          if (!objetivo) return;
          await ejecutar(
            () =>
              objetivo.tipo === "comanda"
                ? anularComanda(comanda.comandaId, motivo)
                : anularItem(comanda.comandaId, objetivo.id, motivo),
            objetivo.tipo === "comanda"
              ? "No se pudo cancelar el pedido"
              : "No se pudo anular el ítem",
          );
          setConfirmando(null);
        }}
      />
    </MotionCard>
  );
}
