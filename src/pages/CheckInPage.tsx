import { useState } from "react";
import { CheckCircle2, QrCode, AlertTriangle } from "lucide-react";
import { m } from "framer-motion";

import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/layout/PageHeader";
import { useReservationStore } from "@/lib/useReservationStore";
import { useAppMotion } from "@/lib/useAppMotion";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/api";
import type { Reservacion } from "@/api";

/**
 * Staff/mostrador check-in view — meant for a tablet at the door. Scanning a
 * physical QR reader is out of scope here (that lives on `/escanear`); staff
 * types the short code from the QR modal, and this seats the reservation the
 * same way a scan would.
 *
 * Deliberately *not* given a gradient hero: this is a single-purpose screen
 * someone uses standing up with a queue in front of them, and the only thing
 * that should be on it is the field and its answer. The rest of the system's
 * language still applies — 24px card, 16px input, gradient icon tile.
 */
export function CheckInPage() {
  const checkInByCode = useReservationStore((s) => s.checkInByCode);
  const motionPrefs = useAppMotion();
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
      <PageHeader title="Check-in" subtitle="Ingresa el código de la reserva para sentar al cliente" />

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
        <m.div
          variants={motionPrefs.rise}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md"
        >
          <Card className="shadow-[var(--shadow-token-md)]">
            <CardBody className="flex flex-col items-center gap-6 py-8">
              <IconTile tone="gradient" size="xl">
                <QrCode size={26} />
              </IconTile>

              <div className="text-center">
                <h2 className="text-xl font-semibold text-fg">Sentar a un cliente</h2>
                <p className="mt-1 text-sm text-fg-muted">
                  El código corto está en el QR de su reserva.
                </p>
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
                  placeholder="R-7K4Q"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-14 text-center font-mono text-xl tracking-[0.25em]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={busy || !code.trim()}
                >
                  {busy ? "Buscando…" : "Sentar cliente"}
                </Button>
              </form>

              {error && (
                <div
                  role="alert"
                  className="flex w-full items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {seated && (
                <div
                  role="status"
                  className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-md)] border border-status-free/40 bg-status-free-soft px-4 py-4 text-center"
                >
                  <CheckCircle2 size={24} className="text-status-free-fg" />
                  <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-medium text-status-free-fg">
                    {seated.clienteNombre} sentado en
                    <Badge tone="free">{seated.mesaEtiqueta}</Badge>
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-status-free-fg/80">
                    {formatDateTime(seated.iniciaEn)}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </m.div>
      </div>
    </div>
  );
}
