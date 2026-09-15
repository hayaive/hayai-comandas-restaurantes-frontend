import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Receipt, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/api";
import type { Cobro, MetodoPago, Moneda, PagoInput } from "@/api";
import { formatTime, formatUsd } from "@/lib/format";
import { TasaRequeridaError, useComandaStore } from "@/lib/useComandaStore";
import { useTasaStore } from "@/lib/useTasaStore";
import { FacturaMesaModal } from "./FacturaMesaModal";
import { cobroAFacturaMesa } from "./facturaMesaData";
import type { FacturaMesaData } from "./FacturaMesaTicket";

/**
 * Cobro de una MESA — el único camino de cobro de la app, compartido por las
 * dos entradas al feature: la pantalla de "Cuentas por cobrar" (todas las
 * mesas con saldo) y la ficha de una mesa ocupada en el plano (una sola).
 *
 * Lo que hace y lo que deliberadamente NO hace:
 *
 * - Cobra TODO lo despachado de la mesa en un solo `Cobro`. Lo que siga en
 *   cocina no entra —lo impide el backend— y se avisa en pantalla, porque para
 *   el cajero es la diferencia entre "cerré la mesa" y "le abrí una cuenta
 *   nueva".
 * - NO calcula el total que se cobra: lo calcula el servidor desde las
 *   comandas bloqueadas. Las cifras de aquí son una previsualización para que
 *   el cajero sepa cuánto pedir, y la factura que se imprime es siempre la que
 *   devolvió el backend.
 * - Soporta pago mixto (varias filas) porque en este negocio es lo normal, no
 *   la excepción: mitad efectivo, mitad pago móvil.
 *
 * Al cobrar, encadena con `FacturaMesaModal` (ya existente) mapeando el `Cobro`
 * real con `cobroAFacturaMesa`.
 */

const METODOS: { valor: MetodoPago; label: string }[] = [
  { valor: "efectivo_usd", label: "Efectivo USD" },
  { valor: "efectivo_bs", label: "Efectivo Bs" },
  { valor: "pago_movil", label: "Pago móvil" },
  { valor: "transferencia", label: "Transferencia" },
  { valor: "punto", label: "Punto de venta" },
  { valor: "binance", label: "Binance" },
  { valor: "otro", label: "Otro" },
];

/** La base lo exige para conciliación bancaria: sin referencia, 422. */
function exigeReferencia(metodo: MetodoPago): boolean {
  return metodo === "pago_movil" || metodo === "transferencia";
}

interface PagoDraft {
  metodo: MetodoPago;
  moneda: Moneda;
  monto: string;
  referencia: string;
  /** Mientras nadie lo toque, la fila se mantiene sincronizada con el total. */
  auto: boolean;
}

function pagoInicial(): PagoDraft {
  return { metodo: "efectivo_usd", moneda: "USD", monto: "", referencia: "", auto: true };
}

export interface CobrarMesaModalProps {
  open: boolean;
  mesaId: string | null;
  mesaEtiqueta?: string | null;
  /** Desde la reserva sentada del plano; el backend no lo trae en el cobro. */
  clienteNombre?: string | null;
  onClose: () => void;
  /** Se dispara con la factura ya emitida, por si la pantalla quiere recargar. */
  onCobrado?: (cobro: Cobro) => void;
}

export function CobrarMesaModal({
  open,
  mesaId,
  mesaEtiqueta,
  clienteNombre,
  onClose,
  onCobrado,
}: CobrarMesaModalProps) {
  const cuentaPorMesa = useComandaStore((s) => s.cuentaPorMesa);
  const cuentaMesaStatus = useComandaStore((s) => s.cuentaMesaStatus);
  const loadCuentaDeMesa = useComandaStore((s) => s.loadCuentaDeMesa);
  const cobrarMesa = useComandaStore((s) => s.cobrarMesa);
  const tasaUsd = useTasaStore((s) => s.vigente?.usd ?? null);
  const guardarTasa = useTasaStore((s) => s.guardarManual);

  const [propina, setPropina] = useState("");
  const [descuento, setDescuento] = useState("");
  const [pagos, setPagos] = useState<PagoDraft[]>([pagoInicial()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasaPrompt, setTasaPrompt] = useState<string | null>(null);
  const [tasaValor, setTasaValor] = useState("");
  const [factura, setFactura] = useState<FacturaMesaData | null>(null);

  const detalle = mesaId ? cuentaPorMesa[mesaId] : undefined;
  const cargando = mesaId ? cuentaMesaStatus[mesaId] === "loading" && !detalle : false;
  const cuenta = detalle?.cuenta ?? null;

  // Al abrir se relee la cuenta: otra caja pudo cobrarla, o pudo entrar una
  // ronda nueva desde que la pantalla de origen cargó su lista.
  useEffect(() => {
    if (!open || !mesaId) return;
    void loadCuentaDeMesa(mesaId);
  }, [open, mesaId, loadCuentaDeMesa]);

  // Formulario limpio por apertura: arrastrar la propina de la mesa anterior
  // sería cobrar de más sin que nadie lo note.
  useEffect(() => {
    if (!open) return;
    setPropina("");
    setDescuento("");
    setPagos([pagoInicial()]);
    setError(null);
    setTasaPrompt(null);
    setTasaValor("");
  }, [open, mesaId]);

  const porCobrar = Number(cuenta?.totalPorCobrar ?? 0);
  const enCocina = Number(cuenta?.totalEnCocina ?? 0);
  const numeroPropina = Number(propina) || 0;
  const numeroDescuento = Number(descuento) || 0;
  /**
   * Previsualización, NO la cifra autoritativa: el servidor la recalcula desde
   * las comandas que bloquea. Sirve para que el cajero sepa cuánto pedir.
   */
  const totalPrevisto = Math.max(0, porCobrar - numeroDescuento + numeroPropina);
  const valorTasa = Number(tasaUsd?.valor ?? 0);

  const comandasCobrables = useMemo(
    () => (detalle?.comandas ?? []).filter((c) => c.despachadaEn != null),
    [detalle],
  );
  const comandasEnCocina = useMemo(
    () => (detalle?.comandas ?? []).filter((c) => c.despachadaEn == null),
    [detalle],
  );

  // La fila de pago que nadie tocó sigue al total: el caso normal es un solo
  // pago por el importe exacto, y escribirlo a mano es trabajo regalado.
  useEffect(() => {
    setPagos((previos) => {
      if (previos.length !== 1 || !previos[0].auto) return previos;
      const fila = previos[0];
      const monto =
        fila.moneda === "BS" && valorTasa > 0
          ? (totalPrevisto * valorTasa).toFixed(2)
          : totalPrevisto.toFixed(2);
      if (fila.monto === monto) return previos;
      return [{ ...fila, monto }];
    });
  }, [totalPrevisto, valorTasa]);

  const recibidoUsd = pagos.reduce((sum, pago) => {
    const monto = Number(pago.monto) || 0;
    if (pago.moneda === "BS") return sum + (valorTasa > 0 ? monto / valorTasa : 0);
    return sum + monto;
  }, 0);
  const diferencia = recibidoUsd - totalPrevisto;
  const cuadra = Math.abs(diferencia) <= 0.01;
  const faltaReferencia = pagos.some((p) => exigeReferencia(p.metodo) && !p.referencia.trim());

  function actualizarPago(index: number, cambios: Partial<PagoDraft>) {
    setPagos((previos) =>
      previos.map((pago, i) => (i === index ? { ...pago, ...cambios } : pago)),
    );
  }

  function agregarPago() {
    // El resto pendiente, para que el pago mixto no obligue a restar a mano.
    const resto = Math.max(0, totalPrevisto - recibidoUsd);
    setPagos((previos) => [
      ...previos.map((p) => ({ ...p, auto: false })),
      { ...pagoInicial(), auto: false, monto: resto.toFixed(2) },
    ]);
  }

  async function ejecutarCobro() {
    if (!mesaId) return;
    setBusy(true);
    setError(null);
    try {
      const entradas: PagoInput[] = pagos.map((pago) => ({
        metodo: pago.metodo,
        moneda: pago.moneda,
        monto: Number(pago.monto),
        ...(pago.referencia.trim() ? { referencia: pago.referencia.trim() } : {}),
      }));
      const cobro = await cobrarMesa(mesaId, {
        ...(numeroPropina > 0 ? { propina: numeroPropina } : {}),
        ...(numeroDescuento > 0 ? { descuento: numeroDescuento } : {}),
        pagos: entradas,
      });
      // La factura se arma con lo que devolvió el backend, nunca con lo que
      // este formulario creía que iba a cobrar.
      setFactura(
        cobroAFacturaMesa(cobro, {
          mesaEtiqueta: mesaEtiqueta ?? cuenta?.mesaEtiqueta ?? detalle?.mesa.etiqueta,
          clienteNombre,
        }),
      );
      onCobrado?.(cobro);
    } catch (err) {
      if (err instanceof TasaRequeridaError) {
        setTasaPrompt(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "No se pudo cobrar la mesa");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Registra la tasa del día y reintenta el cobro en el mismo gesto. */
  async function registrarTasaYCobrar() {
    const valor = Number(tasaValor);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("La tasa debe ser un número mayor a cero");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await guardarTasa(valor, "USD");
      setTasaPrompt(null);
      setTasaValor("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la tasa");
      setBusy(false);
      return;
    }
    setBusy(false);
    await ejecutarCobro();
  }

  const puedeCobrar =
    !busy && !cargando && comandasCobrables.length > 0 && cuadra && !faltaReferencia;

  return (
    <>
      <Modal
        open={open && factura == null}
        onClose={onClose}
        title="Cobrar mesa"
        description={mesaEtiqueta ? `Mesa ${mesaEtiqueta}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void ejecutarCobro()} disabled={!puedeCobrar}>
              <Receipt size={14} />
              {busy ? "Cobrando…" : `Cobrar ${formatUsd(totalPrevisto)}`}
            </Button>
          </>
        }
      >
        {cargando && <p className="py-8 text-center text-sm text-fg-muted">Cargando la cuenta…</p>}

        {!cargando && comandasCobrables.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-fg">Esta mesa no tiene nada por cobrar</p>
            <p className="max-w-[40ch] text-[13px] text-fg-muted">
              {comandasEnCocina.length > 0
                ? "Todo lo que pidió sigue en cocina. Una comanda sólo se puede cobrar después de despacharla."
                : "O ya la cobró otro cajero."}
            </p>
          </div>
        )}

        {!cargando && comandasCobrables.length > 0 && (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[13px] font-semibold text-fg">
                  {comandasCobrables.length}{" "}
                  {comandasCobrables.length === 1 ? "comanda despachada" : "comandas despachadas"}
                </h3>
                <span className="font-mono text-sm tabular-nums font-semibold text-fg">
                  {formatUsd(porCobrar)}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-md)] border border-border">
                {comandasCobrables.map((comanda) => (
                  <li key={comanda.id} className="flex flex-col gap-1 px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[13px] tabular-nums font-semibold text-fg">
                        #{comanda.numeroDia}
                      </span>
                      <span className="text-[12px] text-fg-subtle">
                        {formatTime(comanda.creadaEn)}
                      </span>
                      <span className="ml-auto font-mono text-[13px] tabular-nums text-fg">
                        {formatUsd(comanda.total)}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-fg-muted">
                      {comanda.items
                        .filter((item) => item.canceladoEn == null)
                        .map((item) => `${item.cantidad}× ${item.nombreSnap}`)
                        .join(" · ") || "Sin ítems vivos"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {comandasEnCocina.length > 0 && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-[var(--radius-md)] border border-status-reserved/40 bg-status-reserved-soft px-3.5 py-3 text-[12px] leading-relaxed text-status-reserved-fg"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  {comandasEnCocina.length}{" "}
                  {comandasEnCocina.length === 1 ? "comanda sigue" : "comandas siguen"} en cocina
                  ({formatUsd(enCocina)}). No entra en este cobro: la mesa queda con una cuenta
                  nueva abierta.
                </span>
              </p>
            )}

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Propina (USD)"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={propina}
                placeholder="0.00"
                onChange={(e) => setPropina(e.target.value)}
              />
              <Input
                label="Descuento (USD)"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={descuento}
                placeholder="0.00"
                onChange={(e) => setDescuento(e.target.value)}
              />
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-fg">Pagos</h3>
                <Button size="sm" onClick={agregarPago} disabled={busy}>
                  <Plus size={13} /> Agregar pago
                </Button>
              </div>

              <ul className="flex flex-col gap-3">
                {pagos.map((pago, index) => (
                  <li
                    key={index}
                    className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3"
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      <Select
                        aria-label="Método de pago"
                        value={pago.metodo}
                        disabled={busy}
                        onChange={(e) =>
                          actualizarPago(index, {
                            metodo: e.target.value as MetodoPago,
                            auto: false,
                          })
                        }
                        className="h-10! min-w-[150px] flex-1 text-[13px]!"
                      >
                        {METODOS.map((m) => (
                          <option key={m.valor} value={m.valor}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        aria-label="Moneda"
                        value={pago.moneda}
                        disabled={busy}
                        onChange={(e) =>
                          actualizarPago(index, { moneda: e.target.value as Moneda })
                        }
                        className="h-10! w-[90px] text-[13px]!"
                      >
                        <option value="USD">USD</option>
                        <option value="BS">Bs</option>
                      </Select>
                      <Input
                        label={`Monto (${pago.moneda === "BS" ? "Bs" : "USD"})`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={pago.monto}
                        disabled={busy}
                        onChange={(e) => actualizarPago(index, { monto: e.target.value, auto: false })}
                        fieldClassName="min-w-[120px] flex-1"
                      />
                      {pagos.length > 1 && (
                        <IconButton
                          icon={<Trash2 size={13} />}
                          label="Quitar este pago"
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => setPagos((p) => p.filter((_, i) => i !== index))}
                        />
                      )}
                    </div>
                    {exigeReferencia(pago.metodo) && (
                      <Input
                        label="Referencia"
                        value={pago.referencia}
                        disabled={busy}
                        placeholder="Nº de la operación"
                        onChange={(e) => actualizarPago(index, { referencia: e.target.value })}
                      />
                    )}
                    {pago.moneda === "BS" && valorTasa <= 0 && (
                      <p className="text-[12px] text-danger">
                        No hay tasa del día registrada: un pago en Bs no se puede convertir.
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[13px] text-fg-muted">
                  Recibido {formatUsd(recibidoUsd)} de {formatUsd(totalPrevisto)}
                </span>
                {cuadra ? (
                  <Badge tone="free">Cuadra</Badge>
                ) : (
                  <Badge tone="danger">
                    {diferencia < 0
                      ? `Faltan ${formatUsd(Math.abs(diferencia))}`
                      : `Sobran ${formatUsd(diferencia)}`}
                  </Badge>
                )}
              </div>
              {faltaReferencia && (
                <p className="text-[12px] text-danger">
                  Pago móvil y transferencia exigen número de referencia.
                </p>
              )}
            </section>

            {tasaPrompt && (
              <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-status-reserved/40 bg-status-reserved-soft px-3 py-3">
                <p className="text-[12px] leading-relaxed text-status-reserved-fg">
                  {tasaPrompt} Es el cambio del día en Bs por dólar; queda congelado en cada
                  factura que emitas.
                </p>
                <div className="flex items-end gap-2">
                  <Input
                    label="Tasa (Bs por USD)"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={tasaValor}
                    onChange={(e) => setTasaValor(e.target.value)}
                    fieldClassName="flex-1"
                    autoFocus
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void registrarTasaYCobrar()}
                    disabled={busy}
                  >
                    Guardar y cobrar
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </Modal>

      <FacturaMesaModal
        open={factura != null}
        data={factura}
        onClose={() => {
          setFactura(null);
          onClose();
        }}
      />
    </>
  );
}
