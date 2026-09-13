import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Armchair, Camera, CheckCircle, User, Warning } from "@phosphor-icons/react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { api } from "@/api";
import type { Reservacion } from "@/api";
import { formatDateTime } from "@/lib/format";

/**
 * Pantalla de staff para validar reservas al llegar el cliente, escaneando el
 * QR que `QrCodeModal` genera (`selfSeatUrl`: `${origin}/reservar/:codigoPublico`).
 * Usa `qr-scanner` (nimiq/qr-scanner) — se eligió por ser la más liviana de
 * integrar en Vite: el bundler resuelve su import dinámico del worker sin
 * configuración extra (a diferencia de html5-qrcode, que trae su propia UI
 * de escaneo que habría que desmontar, o @zxing/browser, con una API más
 * verbosa para el mismo resultado).
 */

type Resultado =
  | { tipo: "con_mesa"; reservacion: Reservacion }
  | { tipo: "sin_mesa"; reservacion: Reservacion }
  | { tipo: "inactiva"; reservacion: Reservacion }
  | { tipo: "no_encontrada" }
  | { tipo: "error"; mensaje: string };

/** Evita relanzar la búsqueda en cada frame mientras el mismo QR sigue en cuadro. */
const COOLDOWN_MS = 4000;

/**
 * El QR codifica la URL pública completa (`selfSeatUrl`), no sólo el código:
 * se extrae el segmento después de `/reservar/`. Si alguien apunta la cámara
 * a un QR que sólo trae el código a secas (o se pega a mano), se usa tal cual.
 */
function extraerCodigoPublico(texto: string): string {
  try {
    const url = new URL(texto);
    const partes = url.pathname.split("/").filter(Boolean);
    const idx = partes.indexOf("reservar");
    if (idx !== -1 && partes[idx + 1]) return decodeURIComponent(partes[idx + 1]);
    return partes.length > 0 ? decodeURIComponent(partes[partes.length - 1]) : texto.trim();
  } catch {
    return texto.trim();
  }
}

export function EscanearPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const lastScanAtRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<"starting" | "ready" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const scanner = new QrScanner(video, (result) => void handleDecoded(result.data), {
      preferredCamera: "environment",
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 5,
    });
    scannerRef.current = scanner;

    scanner
      .start()
      .then(() => {
        if (!cancelled) setCameraStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCameraStatus("error");
        setCameraError(
          err instanceof Error ? err.message : "No se pudo acceder a la cámara del dispositivo",
        );
      });

    return () => {
      cancelled = true;
      scanner.destroy();
      scannerRef.current = null;
    };
    // Se monta una sola vez: el ciclo de vida de la cámara no depende de estado de React.
  }, []);

  async function handleDecoded(texto: string) {
    if (busyRef.current) return;
    const now = Date.now();
    if (texto === lastCodeRef.current && now - lastScanAtRef.current < COOLDOWN_MS) return;
    lastCodeRef.current = texto;
    lastScanAtRef.current = now;
    busyRef.current = true;
    setBuscando(true);
    try {
      const codigo = extraerCodigoPublico(texto);
      const reservacion = await api.buscarReservacionPorCodigo(codigo);
      if (!reservacion) {
        setResultado({ tipo: "no_encontrada" });
        return;
      }
      if (reservacion.estado === "cancelada" || reservacion.estado === "no_show") {
        setResultado({ tipo: "inactiva", reservacion });
        return;
      }
      if (!reservacion.mesaId) {
        setResultado({ tipo: "sin_mesa", reservacion });
        return;
      }
      setResultado({ tipo: "con_mesa", reservacion });
    } catch (err) {
      setResultado({
        tipo: "error",
        mensaje: err instanceof Error ? err.message : "No se pudo validar el código escaneado",
      });
    } finally {
      setBuscando(false);
      busyRef.current = false;
    }
  }

  /** Deja la cámara lista para el siguiente cliente sin recargar la pantalla. */
  function handleSiguiente() {
    setResultado(null);
    lastCodeRef.current = null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Escanear"
        subtitle="Valida la reserva de un cliente al llegar, escaneando el QR de su reserva"
      />

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-6">
        <div className="grid w-full max-w-3xl gap-5 md:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="relative aspect-square w-full bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {cameraStatus !== "ready" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center text-white">
                  <Camera size={26} weight="duotone" />
                  <p className="text-[13px]">
                    {cameraStatus === "starting"
                      ? "Activando la cámara…"
                      : (cameraError ?? "No se pudo acceder a la cámara.")}
                  </p>
                </div>
              )}
            </div>
            <CardBody>
              <p className="text-[12px] text-fg-subtle">
                Apunta la cámara al código QR de la reserva del cliente. En cuanto detecte uno
                válido, se busca automáticamente.
              </p>
            </CardBody>
          </Card>

          <Card className="flex flex-col">
            <CardBody className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              {buscando && <p className="text-[13px] text-fg-muted">Buscando reserva…</p>}

              {!buscando && !resultado && (
                <p className="text-[13px] text-fg-muted">
                  Esperando un código QR — aquí aparecerá el resultado de cada escaneo.
                </p>
              )}

              {!buscando && resultado?.tipo === "con_mesa" && (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle size={28} weight="fill" className="text-status-free-fg" />
                  <p className="text-[15px] font-semibold text-fg">{resultado.reservacion.clienteNombre}</p>
                  <Badge tone="free" className="font-mono text-[15px]">
                    <Armchair size={14} /> Mesa {resultado.reservacion.mesaEtiqueta}
                  </Badge>
                  <p className="text-[12px] text-fg-subtle">
                    {resultado.reservacion.personas} personas ·{" "}
                    {formatDateTime(resultado.reservacion.iniciaEn)}
                  </p>
                </div>
              )}

              {!buscando && resultado?.tipo === "sin_mesa" && (
                <div className="flex flex-col items-center gap-2">
                  <User size={26} className="text-status-reserved-fg" weight="duotone" />
                  <p className="text-[14px] font-medium text-fg">{resultado.reservacion.clienteNombre}</p>
                  <p className="max-w-xs text-[13px] text-status-reserved-fg">
                    Esta reserva todavía no tiene mesa asignada; pide al cliente que elija una desde
                    su enlace.
                  </p>
                </div>
              )}

              {!buscando && resultado?.tipo === "inactiva" && (
                <div className="flex flex-col items-center gap-2">
                  <Warning size={26} className="text-danger" weight="duotone" />
                  <p className="text-[14px] font-medium text-fg">{resultado.reservacion.clienteNombre}</p>
                  <p className="max-w-xs text-[13px] text-danger">
                    Esta reserva ya no está activa (
                    {resultado.reservacion.estado === "cancelada" ? "cancelada" : "no se presentó"}
                    ).
                  </p>
                </div>
              )}

              {!buscando && resultado?.tipo === "no_encontrada" && (
                <div className="flex flex-col items-center gap-2">
                  <Warning size={26} className="text-danger" weight="duotone" />
                  <p className="text-[14px] font-medium text-fg">Cliente no registrado</p>
                  <p className="max-w-xs text-[12px] text-fg-subtle">
                    Ese código no corresponde a ninguna reserva.
                  </p>
                </div>
              )}

              {!buscando && resultado?.tipo === "error" && (
                <div className="flex flex-col items-center gap-2">
                  <Warning size={26} className="text-danger" weight="duotone" />
                  <p className="max-w-xs text-[13px] text-danger">{resultado.mensaje}</p>
                </div>
              )}

              {resultado && !buscando && (
                <Button variant="secondary" size="sm" onClick={handleSiguiente} className="mt-2">
                  Escanear siguiente cliente
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
