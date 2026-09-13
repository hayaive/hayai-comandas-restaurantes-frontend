import { useState } from "react";
import { CheckCircle, QrCode, Warning } from "@phosphor-icons/react";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useReservationStore } from "@/lib/useReservationStore";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/api";
import type { Reservacion } from "@/api";

/**
 * Staff/mostrador check-in view — meant for a tablet at the door. Scanning a
 * physical QR reader is out of scope here (no camera library was requested);
 * staff types the short code from the QR modal or paste the full code, and
 * this seats the reservation the same way a scan would.
 */
export function CheckInPage() {
  const checkInByCode = useReservationStore((s) => s.checkInByCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seated, setSeated] = useState<Reservacion | null>(null);

  async function handleSubmit() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setSeated(null);
    try {
      const reservacion = await checkInByCode(trimmed);
      setSeated(reservacion);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el check-in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-[16px] font-semibold text-fg">Check-in</h1>
        <p className="text-[12px] text-fg-muted">Ingresa el código de la reserva para sentar al cliente</p>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-8">
        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col items-center gap-5 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-accent-soft text-accent">
              <QrCode size={26} weight="duotone" />
            </div>

            <form
              className="flex w-full flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <Input
                label="Código de la reserva"
                placeholder="Ej. R-7K4Q"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                className="text-center font-mono text-[18px] tracking-widest"
              />
              <Button type="submit" variant="primary" disabled={busy || !code.trim()}>
                {busy ? "Buscando…" : "Sentar cliente"}
              </Button>
            </form>

            {error && (
              <div className="flex w-full items-start gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                <Warning size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {seated && (
              <div className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-sm)] border border-status-free bg-status-free-soft px-3 py-3 text-center">
                <CheckCircle size={22} className="text-status-free-fg" weight="fill" />
                <p className="text-[13px] font-medium text-status-free-fg">
                  {seated.clienteNombre} sentado en{" "}
                  <Badge tone="free">{seated.mesaEtiqueta}</Badge>
                </p>
                <p className="text-[11px] text-status-free-fg/80">{formatDateTime(seated.iniciaEn)}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
