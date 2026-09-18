import { useEffect, useState } from "react";

import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

/**
 * Confirmación para una acción destructiva.
 *
 * Existe porque el patrón ya estaba repetido a mano (el inspector de mesas
 * arma el suyo inline con dos botones) y porque las acciones de la cola de
 * despacho ocurren sobre un tablet compartido, en una cocina, con las manos
 * ocupadas: ahí un toque accidental que anula el pedido de un cliente no tiene
 * vuelta atrás. Un `window.confirm` no sirve —rompe el look y en algunos
 * navegadores embebidos de PWA ni aparece—, así que va sobre el `Modal` real.
 *
 * `motivoLabel` convierte el diálogo en uno que además captura el porqué: el
 * backend guarda ese texto en la anulación y es lo único que después explica
 * en la traza qué pasó. Se deja opcional porque pedirlo en cada línea suelta
 * sería fricción pura en pleno servicio.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void | Promise<void>;
  title: string;
  description: string;
  /** Texto del botón que ejecuta. Debe nombrar la acción, no decir "Aceptar". */
  confirmLabel: string;
  /** Si se pasa, el diálogo muestra un campo de texto con esta etiqueta. */
  motivoLabel?: string;
  /** Valor inicial del motivo, y el que se envía si el usuario no escribe nada. */
  motivoPorDefecto?: string;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  motivoLabel,
  motivoPorDefecto = "",
  busy = false,
}: ConfirmDialogProps) {
  const [motivo, setMotivo] = useState(motivoPorDefecto);

  // Cada apertura arranca limpia: sin esto, el motivo tecleado para una
  // anulación anterior reaparecería prellenado en la siguiente y se enviaría
  // sin que nadie lo relea.
  useEffect(() => {
    if (open) setMotivo(motivoPorDefecto);
  }, [open, motivoPorDefecto]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => void onConfirm(motivo.trim() || motivoPorDefecto)}
            disabled={busy}
          >
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </>
      }
    >
      {motivoLabel && (
        <Input
          label={motivoLabel}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={motivoPorDefecto}
        />
      )}
    </Modal>
  );
}
