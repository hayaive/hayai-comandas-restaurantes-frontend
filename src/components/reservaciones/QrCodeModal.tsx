import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDateTime, selfSeatUrl } from "@/lib/format";
import { buildReservationShareCard, SHARE_CARD_QR_LOGICAL_SIZE } from "@/lib/shareCard";
import { useRestauranteStore } from "@/lib/useRestauranteStore";
import type { Reservacion } from "@/api";

/**
 * El nombre sale ahora de `GET /restaurante` (pantalla de Configuración), no
 * de `VITE_RESTAURANTE_NOMBRE`: esa era una variable de BUILD y cambiarla
 * exigía recompilar. El fallback sólo cubre la ventana entre que arranca la
 * app y responde el bootstrap del store; nunca debería verse en una tarjeta
 * real, porque para llegar aquí hay que haber navegado a Reservaciones.
 */
function nombreDelRestaurante(): string {
  return useRestauranteStore.getState().restaurante?.nombre ?? "Coffee & Cake";
}

export interface QrCodeModalProps {
  reservacion: Reservacion | null;
  onClose: () => void;
}

type CardState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "ready"; blob: Blob; previewUrl: string }
  | { status: "error"; message: string };

export function QrCodeModal({ reservacion, onClose }: QrCodeModalProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cardState, setCardState] = useState<CardState>({ status: "idle" });
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Al menos 2x aunque el dispositivo tenga devicePixelRatio 1 (escritorio):
  // la tarjeta va a abrirse a pantalla completa en WhatsApp, no sólo a verse
  // como miniatura, y ahí un canvas 1:1 sale visiblemente borroso. Tope en 3x
  // para no generar un PNG innecesariamente pesado.
  const exportScale = useMemo(() => Math.min(3, Math.max(2, window.devicePixelRatio || 1)), []);

  /**
   * ⚠️ El `size` que se le pide a `QRCodeCanvas` NO es el tamaño de su canvas.
   * `qrcode.react` lo multiplica por su cuenta:
   *
   *     canvas.height = canvas.width = size * window.devicePixelRatio
   *
   * Si le pidiéramos directamente los píxeles que necesita la tarjeta, en un
   * teléfono con `devicePixelRatio` 3 el canvas saldría 3× más grande que el
   * hueco donde se dibuja, y `drawImage` lo reduciría CON SUAVIZADO — que
   * convierte los bordes de los módulos en gris difuminado y deja el QR
   * ilegible para cualquier escáner. En un escritorio (`dpr` 1) salía 1:1 y
   * por eso el fallo sólo aparecía en móvil.
   *
   * Dividir aquí por el mismo `dpr` cancela esa multiplicación: el canvas
   * queda EXACTAMENTE del tamaño que la tarjeta va a pintar, así que no hay
   * reescalado de por medio, sea cual sea el `dpr` (incluso los fraccionarios
   * de algunos Android, donde ni el suavizado desactivado salvaría los
   * módulos).
   */
  const qrPixelSize = useMemo(() => {
    const dpr = window.devicePixelRatio || 1;
    return (SHARE_CARD_QR_LOGICAL_SIZE * exportScale) / dpr;
  }, [exportScale]);

  useEffect(() => {
    if (!reservacion) {
      setCardState({ status: "idle" });
      return;
    }

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let createdUrl: string | null = null;

    setCardState({ status: "building" });
    setShareNotice(null);

    async function run() {
      const qrCanvas = qrCanvasRef.current;
      if (!qrCanvas || cancelled || !reservacion) return;
      try {
        const blob = await buildReservationShareCard({
          qrCanvas,
          reservacion,
          restauranteNombre: nombreDelRestaurante(),
          exportScale,
        });
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setCardState({ status: "ready", blob, previewUrl: createdUrl });
      } catch (error) {
        if (cancelled) return;
        setCardState({
          status: "error",
          message: error instanceof Error ? error.message : "No se pudo generar la tarjeta.",
        });
      }
    }

    // `qrcode.react` pinta el QR en su propio efecto al montar el canvas
    // oculto de abajo; ese pintado tiene que estar en el canvas ANTES de
    // leerlo con drawImage, o sale en blanco de forma intermitente (mismo
    // motivo por el que el logo espera su propio onload en shareCard.ts).
    // Un doble requestAnimationFrame garantiza que ya hubo al menos un pintado
    // real del navegador de por medio.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        void run();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [reservacion, exportScale]);

  function handleDownload() {
    if (cardState.status !== "ready" || !reservacion) return;
    const link = document.createElement("a");
    link.href = cardState.previewUrl;
    link.download = `reserva-${reservacion.codigoCorto}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleShare() {
    if (cardState.status !== "ready" || !reservacion) return;
    const mensaje = buildMensajeWhatsapp(reservacion);
    const file = new File([cardState.blob], `reserva-${reservacion.codigoCorto}.png`, {
      type: "image/png",
    });

    // Camino principal: Web Share API con la imagen como archivo adjunto —
    // en móvil es lo que abre el selector nativo con WhatsApp incluido.
    // `canShare` hay que comprobarlo aparte de la existencia de `share`:
    // algunos navegadores tienen `navigator.share` pero no soportan
    // compartir archivos, sólo texto/URL.
    const canShareFile =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFile) {
      try {
        await navigator.share({
          files: [file],
          title: `Reserva de ${reservacion.clienteNombre}`,
          text: mensaje,
        });
        setShareNotice(null);
      } catch (error) {
        // AbortError = la persona cerró el selector sin elegir nada; no es
        // un fallo real y no amerita mensaje ni fallback.
        if (error instanceof Error && error.name === "AbortError") return;
        openWhatsappFallback(reservacion, mensaje);
      }
      return;
    }

    openWhatsappFallback(reservacion, mensaje);
  }

  function openWhatsappFallback(target: Reservacion, mensaje: string) {
    const telefono = cleanTelefonoVE(target.clienteTelefono);
    const url = telefono
      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShareNotice(
      "Se abrió WhatsApp con el mensaje y el enlace de la reserva, pero por ahí la imagen no viaja. Descarga la tarjeta abajo y adjúntala tú mismo al chat.",
    );
  }

  return (
    <Modal
      open={reservacion !== null}
      onClose={onClose}
      title="Compartir reserva"
      description={reservacion ? reservacion.clienteNombre : undefined}
    >
      {reservacion && (
        <div className="flex flex-col items-center gap-4">
          {/* Fuente oculta del QR: qrcode.react pinta aquí, en alta
              resolución (ya multiplicada por exportScale), únicamente para
              que buildReservationShareCard la lea con drawImage. Lo que se
              VE es la tarjeta compuesta de abajo, no este canvas. */}
          <div className="hidden" aria-hidden="true">
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={selfSeatUrl(reservacion.codigoPublico)}
              size={qrPixelSize}
              level="M"
            />
          </div>

          <div className="w-full max-w-[280px] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-sunken shadow-[var(--shadow-token-sm)]">
            {cardState.status === "ready" && (
              <img
                src={cardState.previewUrl}
                alt={`Tarjeta de reserva de ${reservacion.clienteNombre} para el ${formatDateTime(reservacion.iniciaEn)}`}
                className="block w-full"
              />
            )}
            {cardState.status === "building" && (
              <div className="flex aspect-[2/3] items-center justify-center p-6 text-center text-[12px] text-fg-subtle">
                Generando la tarjeta…
              </div>
            )}
            {cardState.status === "error" && (
              <div className="flex aspect-[2/3] flex-col items-center justify-center gap-1 p-6 text-center text-[12px]">
                <span className="text-danger">No se pudo generar la tarjeta.</span>
                <span className="text-fg-subtle">{cardState.message}</span>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={handleShare} disabled={cardState.status !== "ready"}>
              <Share2 size={14} /> Compartir por WhatsApp
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleDownload}
              disabled={cardState.status !== "ready"}
            >
              <Download size={14} /> Descargar
            </Button>
          </div>

          {shareNotice && (
            <p className="max-w-sm text-center text-[12px] leading-relaxed text-fg-subtle">
              {shareNotice}
            </p>
          )}

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

/** Texto que acompaña la imagen en `navigator.share` y el cuerpo del mensaje
 * en el fallback `wa.me` — usa `formatDateTime`, el mismo formateador que ya
 * existe en el proyecto, en vez de escribir uno nuevo. */
function buildMensajeWhatsapp(reservacion: Reservacion): string {
  return `Hola ${reservacion.clienteNombre}, esta es tu reserva en ${nombreDelRestaurante()} para el ${formatDateTime(
    reservacion.iniciaEn,
  )}. Preséntala al llegar: ${selfSeatUrl(reservacion.codigoPublico)}`;
}

/**
 * `Reservacion.clienteTelefono` se guarda en formato local venezolano con el
 * 0 de troncal ("0414-1234567", ver los seeds de `mockClient.ts`) — eso es lo
 * que muestran los formularios. `wa.me` necesita el número en formato
 * internacional, SIN el 0 inicial y CON el código de país (58 para
 * Venezuela): pasarle el número local tal cual — aunque ya limpio de
 * espacios/guiones/"+" — abre WhatsApp apuntando a un número que no existe y
 * el chat directo con el cliente nunca se abre. El brief sólo pedía limpiar
 * símbolos; esta conversión de más no estaba pedida explícitamente, pero sin
 * ella el botón "abrir chat con el cliente" no cumpliría lo que promete —
 * ver el reporte final.
 */
function cleanTelefonoVE(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("58")) return digits;
  if (digits.startsWith("0")) return `58${digits.slice(1)}`;
  return `58${digits}`;
}
