import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { selfSeatUrl } from "@/lib/format";
import type { Reservacion } from "@/api";

export interface QrCodeModalProps {
  reservacion: Reservacion | null;
  onClose: () => void;
}

export function QrCodeModal({ reservacion, onClose }: QrCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !reservacion) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `reserva-${reservacion.codigoCorto}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

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
            <QRCodeCanvas ref={canvasRef} value={selfSeatUrl(reservacion.codigoPublico)} size={196} level="M" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px] text-fg-muted">Código para la puerta</span>
            <Badge tone="accent" className="font-mono text-[14px]">
              {reservacion.codigoCorto}
            </Badge>
          </div>
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Download size={14} /> Descargar QR
          </Button>
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
