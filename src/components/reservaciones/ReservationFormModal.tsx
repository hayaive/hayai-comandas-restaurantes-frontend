import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useActiveTemplate } from "@/lib/useFloorPlanStore";
import { useReservationStore } from "@/lib/useReservationStore";
import { ApiError } from "@/api";

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

export function ReservationFormModal({ open, onClose }: ReservationFormModalProps) {
  const activeTemplate = useActiveTemplate();
  const create = useReservationStore((s) => s.create);

  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [personas, setPersonas] = useState(2);
  const [iniciaEn, setIniciaEn] = useState(() => defaultDateTimeLocal(1));
  const [mesaId, setMesaId] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTables = useMemo(
    () => activeTemplate.tables.filter((t) => t.status === "free"),
    [activeTemplate.tables],
  );

  function reset() {
    setClienteNombre("");
    setClienteTelefono("");
    setPersonas(2);
    setIniciaEn(defaultDateTimeLocal(1));
    setMesaId("");
    setNotas("");
    setError(null);
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
      const mesa = availableTables.find((t) => t.id === mesaId);
      await create({
        clienteNombre: clienteNombre.trim(),
        clienteTelefono: clienteTelefono.trim() || undefined,
        personas,
        iniciaEn: new Date(iniciaEn).toISOString(),
        mesaId: mesa?.id,
        mesaEtiqueta: mesa?.label,
        notas: notas.trim() || undefined,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la reserva");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Nueva reserva"
      description="La mesa se marcará como reservada de inmediato en el plano."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Creando…" : "Crear reserva"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          label="Nombre del cliente"
          value={clienteNombre}
          onChange={(e) => setClienteNombre(e.target.value)}
          placeholder="Ej. Familia Restrepo"
          maxLength={80}
          autoFocus
        />
        <Input
          label="Teléfono (opcional)"
          value={clienteTelefono}
          onChange={(e) => setClienteTelefono(e.target.value)}
          placeholder="0414-1234567"
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
            label="Fecha y hora"
            type="datetime-local"
            value={iniciaEn}
            onChange={(e) => setIniciaEn(e.target.value)}
          />
        </div>
        <Select
          label={`Mesa (${activeTemplate.name})`}
          value={mesaId}
          onChange={(e) => setMesaId(e.target.value)}
        >
          <option value="">Sin asignar — el cliente elige por enlace</option>
          {availableTables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.label} · {table.seats} sillas
            </option>
          ))}
        </Select>
        <Input
          label="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej. Pidió mesa en la terraza"
        />
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
