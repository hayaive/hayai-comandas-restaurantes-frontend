import { QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { selfSeatUrl } from "@/lib/format";
import type { Reservacion } from "@/api";

export interface QrCodeModalProps {
  reservacion: Reservacion | null;
  onClose: () => void;
}

export function QrCodeModal({ reservacion, onClose }: QrCodeModalProps) {
  return (
    <Modal
      open={reservacion !== null}
      onClose={onClose}
      title="Código de la reserva"
      description={reservacion ? reservacion.clienteNombre : undefined}
    >
      {reservacion && (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-[var(--radius-md)] border border-border bg-white p-4">
            <QRCodeSVG value={selfSeatUrl(reservacion.codigoPublico)} size={196} level="M" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px] text-fg-muted">Código para la puerta</span>
            <Badge tone="accent" className="font-mono text-[14px]">
              {reservacion.codigoCorto}
            </Badge>
          </div>
          <p className="max-w-xs text-center text-[12px] text-fg-subtle">
            Al escanearlo, el cliente abre el enlace para elegir su mesa (si aún no tiene una) o
            confirmar la suya. El mostrador usa el mismo código en{" "}
            <span className="font-mono text-fg-muted">/checkin</span> para sentarlo.
          </p>
        </div>
      )}
    </Modal>
  );
}
