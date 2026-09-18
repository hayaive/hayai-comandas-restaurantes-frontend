import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { AccesoTemporal } from "@/api";

/**
 * Qué regenerar de un acceso vivo — por defecto los dos, como manda el
 * contrato (`RegenerarAccesoInput` con ambos flags ausentes = ambos). El
 * dueño puede destildar uno si sólo quiere invalidar, por ejemplo, el código
 * (alguien lo vio por encima del hombro) sin tener que reenviar un enlace
 * nuevo por WhatsApp.
 */
export interface RegenerarAccesoModalProps {
  acceso: AccesoTemporal | null;
  onClose: () => void;
  onConfirm: (opciones: { enlace: boolean; codigo: boolean }) => void | Promise<void>;
  busy?: boolean;
}

export function RegenerarAccesoModal({ acceso, onClose, onConfirm, busy = false }: RegenerarAccesoModalProps) {
  const [enlace, setEnlace] = useState(true);
  const [codigo, setCodigo] = useState(true);

  return (
    <Modal
      open={acceso !== null}
      onClose={onClose}
      title={acceso ? `Regenerar acceso de ${acceso.nombre}` : "Regenerar acceso"}
      description="Invalida lo anterior de inmediato. Vuelve a mostrarse una sola vez, como al crear."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => void onConfirm({ enlace, codigo })}
            disabled={busy || (!enlace && !codigo)}
          >
            {busy ? "Regenerando…" : "Regenerar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3 py-2.5 text-sm text-fg">
          <input
            type="checkbox"
            checked={enlace}
            onChange={(e) => setEnlace(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Enlace
        </label>
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3 py-2.5 text-sm text-fg">
          <input
            type="checkbox"
            checked={codigo}
            onChange={(e) => setCodigo(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Código
        </label>
      </div>
    </Modal>
  );
}
