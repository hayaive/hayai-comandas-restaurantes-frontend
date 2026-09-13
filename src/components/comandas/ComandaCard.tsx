import { useState } from "react";
import { Plus, Receipt, User, X } from "@phosphor-icons/react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { api, ApiError } from "@/api";
import type { Comanda, EstadoComandaItem } from "@/api";
import { COMANDA_ESTADO_META, COMANDA_ITEM_META, COMANDA_ITEM_ORDER } from "@/lib/comandaMeta";
import { formatTime } from "@/lib/format";
import { TasaRequeridaError, useComandaStore } from "@/lib/useComandaStore";
import { DualPrice } from "@/components/shared/DualPrice";
import { AddItemModal } from "./AddItemModal";

export function ComandaCard({ comanda }: { comanda: Comanda }) {
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Se abre sólo si el backend rechaza el cobro por falta de tasa del día. */
  const [tasaPrompt, setTasaPrompt] = useState<string | null>(null);
  const [tasaValor, setTasaValor] = useState("");
  const addItem = useComandaStore((s) => s.addItem);
  const setItemEstado = useComandaStore((s) => s.setItemEstado);
  const removeItem = useComandaStore((s) => s.removeItem);
  const cobrarYLiberar = useComandaStore((s) => s.cobrarYLiberar);

  const activeItems = comanda.items.filter((item) => item.estado !== "cancelado");
  const estadoMeta = COMANDA_ESTADO_META[comanda.estado];

  async function handleCobrar() {
    setBusy(true);
    setError(null);
    try {
      await cobrarYLiberar(comanda.id);
    } catch (err) {
      if (err instanceof TasaRequeridaError) {
        setTasaPrompt(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "No se pudo cobrar la comanda");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Registra la tasa del día y reintenta el cobro en el mismo gesto. */
  async function handleRegistrarTasaYCobrar() {
    const valor = Number(tasaValor);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("La tasa debe ser un número mayor a cero");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.registrarTasa(valor, "manual");
      setTasaPrompt(null);
      setTasaValor("");
      await cobrarYLiberar(comanda.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la tasa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[15px] font-semibold text-fg">{comanda.mesaEtiqueta}</span>
          <Badge tone={estadoMeta.tone}>{estadoMeta.label}</Badge>
        </div>
        <span className="font-mono text-[12px] text-fg-subtle">{formatTime(comanda.abiertaEn)}</span>
      </CardHeader>

      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          <User size={15} />
          {comanda.clienteNombre ?? "Sin nombre registrado"}
          <span className="text-fg-subtle">· {comanda.comensales} pers.</span>
        </div>

        {activeItems.length === 0 ? (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-border px-3 py-4 text-center text-[13px] text-fg-subtle">
            Sin ítems todavía
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {activeItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-2">
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-fg">
                    {item.cantidad}× {item.nombreSnap}
                  </p>
                  <DualPrice usd={item.totalLinea} className="font-mono text-[11px] text-fg-subtle" />
                </div>
                <Select
                  aria-label={`Estado de ${item.nombreSnap}`}
                  value={item.estado}
                  disabled={busy}
                  onChange={(e) =>
                    void setItemEstado(comanda.id, item.id, e.target.value as EstadoComandaItem)
                  }
                  className="h-7! w-[132px] text-[12px]!"
                >
                  {COMANDA_ITEM_ORDER.map((estado) => (
                    <option key={estado} value={estado}>
                      {COMANDA_ITEM_META[estado].label}
                    </option>
                  ))}
                </Select>
                <IconButton
                  icon={<X size={13} />}
                  label={`Cancelar ${item.nombreSnap}`}
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => void removeItem(comanda.id, item.id, "Cancelado desde el panel de comandas")}
                />
              </li>
            ))}
          </ul>
        )}

        <div className={cn("flex items-center justify-between border-t border-border pt-3")}>
          <span className="text-[13px] font-medium text-fg-muted">Total</span>
          <DualPrice usd={comanda.total} className="font-mono text-[16px] font-semibold text-fg" />
        </div>

        {tasaPrompt && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-status-reserved bg-status-reserved-soft px-3 py-2.5">
            <p className="text-[12px] text-status-reserved-fg">
              {tasaPrompt} Es el cambio del día en Bs por dólar; queda congelado en cada comanda
              que cobres.
            </p>
            <div className="flex items-end gap-2">
              <Input
                label="Tasa (Bs por USD)"
                type="number"
                min={0}
                step="0.01"
                value={tasaValor}
                onChange={(e) => setTasaValor(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleRegistrarTasaYCobrar()}
                disabled={busy}
              >
                Guardar y cobrar
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Agregar ítem
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleCobrar()} disabled={busy}>
            <Receipt size={14} /> {busy ? "Cobrando…" : "Cobrar y cerrar"}
          </Button>
        </div>
      </CardBody>

      <AddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mesaLabel={comanda.mesaEtiqueta}
        onAdd={(productoId, cantidad) => addItem(comanda.id, productoId, cantidad)}
      />
    </Card>
  );
}
