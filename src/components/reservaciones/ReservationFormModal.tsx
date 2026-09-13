import { useState } from "react";
import { ArrowLeft, Users } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useActiveTemplate } from "@/lib/useFloorPlanStore";
import { useReservationStore } from "@/lib/useReservationStore";
import { ApiError } from "@/api";
import type { RestaurantTable } from "@/lib/types";
import { TablePickerStep } from "./TablePickerStep";

export interface ReservationFormModalProps {
  open: boolean;
  onClose: () => void;
}

function defaultDateTimeLocal(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 3_600_000);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Step = "mesa" | "datos";

/**
 * Alta de reserva en dos pasos: primero la mesa sobre la vista aérea del
 * salón, después los datos del cliente.
 *
 * Elegir la mesa primero es lo que hace el anfitrión en la realidad, y así el
 * formulario ya sabe si la reserva nace con mesa asignada o si queda para que
 * el cliente la elija desde su enlace público.
 */
export function ReservationFormModal({ open, onClose }: ReservationFormModalProps) {
  const activeTemplate = useActiveTemplate();
  const create = useReservationStore((s) => s.create);

  const [step, setStep] = useState<Step>("mesa");
  const [mesa, setMesa] = useState<RestaurantTable | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [personas, setPersonas] = useState(2);
  const [iniciaEn, setIniciaEn] = useState(() => defaultDateTimeLocal(1));
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("mesa");
    setMesa(null);
    setClienteNombre("");
    setClienteTelefono("");
    setPersonas(2);
    setIniciaEn(defaultDateTimeLocal(1));
    setNotas("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function pickTable(table: RestaurantTable) {
    setMesa(table);
    // Las sillas de la mesa son el mejor primer valor para el número de personas.
    setPersonas(table.seats);
    setError(null);
    setStep("datos");
  }

  function skipTable() {
    setMesa(null);
    setError(null);
    setStep("datos");
  }

  async function handleSubmit() {
    if (!clienteNombre.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }
    if (personas < 1) {
      setError("El número de personas debe ser al menos 1");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await create({
        clienteNombre: clienteNombre.trim(),
        clienteTelefono: clienteTelefono.trim() || undefined,
        personas,
        iniciaEn: new Date(iniciaEn).toISOString(),
        mesaId: mesa?.id,
        mesaEtiqueta: mesa?.label,
        notas: notas.trim() || undefined,
      });
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la reserva");
    } finally {
      setSubmitting(false);
    }
  }

  const enMesa = step === "mesa";

  return (
    <Modal
      open={open}
      onClose={close}
      size={enMesa ? "lg" : "md"}
      title="Nueva reserva"
      description={
        enMesa
          ? "Paso 1 de 2 · Elige la mesa en el plano del salón"
          : "Paso 2 de 2 · Datos de la reserva"
      }
      footer={
        enMesa ? (
          <>
            <Button variant="secondary" size="sm" onClick={close}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={skipTable}>
              Dejar que el cliente elija la mesa
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => setStep("mesa")} disabled={submitting}>
              <ArrowLeft size={14} /> Cambiar mesa
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? "Creando…" : "Crear reserva"}
            </Button>
          </>
        )
      }
    >
      {enMesa ? (
        <TablePickerStep template={activeTemplate} onPick={pickTable} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2.5">
            {mesa ? (
              <>
                <span className="flex items-center gap-2 text-[13px] text-fg-muted">
                  <Users size={15} /> Mesa asignada
                </span>
                <Badge tone="free">
                  {mesa.label} · {mesa.seats} sillas
                </Badge>
              </>
            ) : (
              <>
                <span className="text-[13px] text-fg-muted">Sin mesa asignada</span>
                <Badge tone="reserved">La elige el cliente</Badge>
              </>
            )}
          </div>

          <Input
            label="Nombre"
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
            maxLength={80}
            autoFocus
          />
          <Input
            label="Teléfono"
            value={clienteTelefono}
            onChange={(e) => setClienteTelefono(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Personas"
              type="number"
              min={1}
              max={200}
              value={personas}
              onChange={(e) => setPersonas(Number(e.target.value))}
            />
            <Input
              label="Fecha y hora de llegada"
              type="datetime-local"
              value={iniciaEn}
              onChange={(e) => setIniciaEn(e.target.value)}
            />
          </div>
          <Input label="Nota" value={notas} onChange={(e) => setNotas(e.target.value)} />

          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
