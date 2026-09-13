import { useRef } from "react";
import { Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
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
          <div className="rounded-[var(--radius-lg)] border border-border bg-white p-5 shadow-[var(--shadow-token-sm)]">
            <QRCodeCanvas ref={canvasRef} value={selfSeatUrl(reservacion.codigoPublico)} size={196} level="M" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px] text-fg-muted">Código para la puerta</span>
            <Badge tone="active" className="font-mono text-base tracking-widest">
              {reservacion.codigoCorto}
            </Badge>
          </div>
          <Button onClick={handleDownload}>
            <Download size={14} /> Descargar QR
          </Button>
          <p className="max-w-sm text-center text-[12px] leading-relaxed text-fg-subtle">
            Al escanearlo, el cliente abre el enlace para elegir su mesa (si aún no tiene una) o
            confirmar la suya. El mostrador usa el mismo código en{" "}
            <span className="font-mono text-fg-muted">/checkin</span> para sentarlo.
          </p>
        </div>
      )}
    </Modal>
  );
}
