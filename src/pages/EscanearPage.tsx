import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Armchair, Camera, CheckCircle2, User } from "lucide-react";
import QrScanner from "qr-scanner";
import { Card, CardBody } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableCardsPicker } from "@/components/floor-plan/TableCardsPicker";
import { api, ApiError } from "@/api";
import type { Reservacion } from "@/api";
import { useReservationStore } from "@/lib/useReservationStore";
import { useActiveTemplate } from "@/lib/useFloorPlanStore";
import type { RestaurantTable } from "@/lib/types";
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
  | { tipo: "ya_escaneada"; reservacion: Reservacion }
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
  const checkInByCode = useReservationStore((s) => s.checkInByCode);
  const assignTable = useReservationStore((s) => s.assignTable);
  const activeTemplate = useActiveTemplate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const lastScanAtRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<"starting" | "ready" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [asignando, setAsignando] = useState(false);
  const [asignarError, setAsignarError] = useState<string | null>(null);

  /**
   * Se busca primero de forma sólo-lectura para poder mostrar el detalle de la
   * reserva incluso cuando no procede sentarla (sin mesa, cancelada, ya
   * sentada). Sólo cuando la reserva está activa y tiene mesa asignada se
   * invoca `checkInByCode`, que es quien realmente sienta al cliente y ocupa
   * la mesa (`useReservationStore.ts`) — igual que hace `CheckInPage` con el
   * flujo manual.
   *
   * `useCallback` con `[checkInByCode]` mantiene la función estable entre
   * renders (la acción de Zustand nunca cambia de identidad), para que el
   * `useEffect` de la cámara, más abajo, pueda declararla como dependencia
   * sin reiniciarla en cada render.
   */
  const handleDecoded = useCallback(
    async (texto: string) => {
      if (busyRef.current) return;
      const now = Date.now();
      if (texto === lastCodeRef.current && now - lastScanAtRef.current < COOLDOWN_MS) return;
      lastCodeRef.current = texto;
      lastScanAtRef.current = now;
      busyRef.current = true;
      setBuscando(true);
      scannerRef.current?.pause();
      try {
        const codigo = extraerCodigoPublico(texto);
        const reservacion = await api.buscarReservacionPorCodigo(codigo);
        if (!reservacion) {
          setResultado({ tipo: "no_encontrada" });
          return;
        }
        if (reservacion.estado === "sentada") {
          setResultado({ tipo: "ya_escaneada", reservacion });
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
        const sentada = await checkInByCode(codigo);
        setResultado({ tipo: "con_mesa", reservacion: sentada });
      } catch (err) {
        setResultado({
          tipo: "error",
          mensaje: err instanceof ApiError ? err.message : "No se pudo validar el código escaneado",
        });
      } finally {
        setBuscando(false);
        busyRef.current = false;
      }
    },
    [checkInByCode],
  );

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
    // handleDecoded es estable (useCallback + acción de Zustand estable), así que
    // este efecto sigue montando la cámara una sola vez pese a listar la dependencia.
  }, [handleDecoded]);

  /** Deja la cámara lista para el siguiente cliente sin recargar la pantalla. */
  function handleSiguiente() {
    setResultado(null);
    setAsignarError(null);
    lastCodeRef.current = null;
    scannerRef.current?.start().catch((err: unknown) => {
      setCameraStatus("error");
      setCameraError(
        err instanceof Error ? err.message : "No se pudo reanudar la cámara del dispositivo",
      );
    });
  }

  /**
   * Asigna la mesa elegida desde el resultado `sin_mesa` y sienta al cliente
   * de una vez, para no obligar al anfitrión a un segundo paso. Usa la misma
   * acción `assignTable` del store que ya usa `SelfSeatPage` (en vez de
   * llamar `api.asignarMesaReservacion` directo aquí) porque esa acción ya
   * sincroniza el plano (`setStatus` + `refreshPlano`) — duplicar esa lógica
   * aquí dejaría el plano desactualizado hasta el próximo poll.
   *
   * Si algo falla, el escaneo no se pierde: `resultado` sigue en `sin_mesa` y
   * el error se muestra aparte para poder reintentar con otra mesa.
   */
  async function handleAsignarMesa(mesa: RestaurantTable) {
    if (resultado?.tipo !== "sin_mesa") return;
    const codigoPublico = resultado.reservacion.codigoPublico;
    setAsignando(true);
    setAsignarError(null);
    try {
      await assignTable(codigoPublico, mesa.id, mesa.label);
      const sentada = await checkInByCode(codigoPublico);
      setResultado({ tipo: "con_mesa", reservacion: sentada });
    } catch (err) {
      setAsignarError(
        err instanceof ApiError ? err.message : "No se pudo asignar la mesa a la reserva",
      );
    } finally {
      setAsignando(false);
    }
  }

  /**
   * Mientras se resuelve el escaneo o ya hay un resultado, la cámara se oculta
   * (queda montada y en pausa — ver `handleDecoded`/`handleSiguiente` — para
   * no reiniciar el stream) y el resultado pasa a ocupar toda la vista.
   */
  const mostrandoResultado = buscando || resultado !== null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Escanear"
        subtitle="Valida la reserva de un cliente al llegar, escaneando el QR de su reserva"
      />

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6">
        {/*
          Un único ancho de columna (`max-w-md`) para los dos estados: antes
          el estado sin resultado usaba un grid de 2 columnas para poner la
          cámara junto a un card "esperando QR" que no llevaba a ningún lado.
          Quitado ese card muerto, sólo queda la cámara sola y centrada.
        */}
        <div className="flex w-full max-w-md flex-col gap-5">
          <Card className={mostrandoResultado ? "hidden" : "overflow-hidden"}>
            <div className="relative aspect-square w-full bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {cameraStatus !== "ready" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center text-white">
                  <Camera size={26} />
                  <p className="text-sm">
                    {cameraStatus === "starting"
                      ? "Activando la cámara…"
                      : (cameraError ?? "No se pudo acceder a la cámara.")}
                  </p>
                </div>
              )}
            </div>
            <CardBody>
              <p className="text-[12px] leading-relaxed text-fg-subtle">
                Apunta la cámara al código QR de la reserva del cliente. En cuanto detecte uno
                válido, se busca automáticamente.
              </p>
            </CardBody>
          </Card>

          {mostrandoResultado && (
            <Card className="flex flex-col">
              <CardBody className="flex flex-1 flex-col items-center justify-center gap-4 py-14 text-center sm:py-20">
                {buscando && <p className="text-sm text-fg-muted">Buscando reserva…</p>}

                {!buscando && resultado?.tipo === "con_mesa" && (
                  <div className="flex flex-col items-center gap-2">
                    <IconTile tone="free" size="xl">
                      <CheckCircle2 size={26} />
                    </IconTile>
                    <p className="text-lg font-semibold text-fg">
                      {resultado.reservacion.clienteNombre}
                    </p>
                    <Badge tone="free" className="font-mono text-base tabular-nums">
                      <Armchair size={14} /> Mesa {resultado.reservacion.mesaEtiqueta}
                    </Badge>
                    <p className="text-[12px] text-fg-subtle">
                      {resultado.reservacion.personas} personas ·{" "}
                      {formatDateTime(resultado.reservacion.iniciaEn)}
                    </p>
                  </div>
                )}

                {!buscando && resultado?.tipo === "sin_mesa" && (
                  <div className="flex w-full flex-col items-center gap-3">
                    <IconTile tone="reserved" size="xl">
                      <User size={26} />
                    </IconTile>
                    <p className="text-base font-medium text-fg">
                      {resultado.reservacion.clienteNombre}
                    </p>
                    <p className="max-w-xs text-sm text-status-reserved-fg">
                      Esta reserva todavía no tiene mesa asignada. Elige una para sentar al
                      cliente ahora.
                    </p>

                    {asignando && <p className="text-sm text-fg-muted">Asignando mesa…</p>}
                    {asignarError && (
                      <p role="alert" className="max-w-xs text-[12px] text-danger">
                        {asignarError}
                      </p>
                    )}

                    {activeTemplate.tables.filter((t) => t.status === "free").length === 0 ? (
                      <p className="max-w-xs text-[12px] text-fg-subtle">
                        No hay mesas libres en este momento.
                      </p>
                    ) : (
                      <div className="w-full text-left">
                        <TableCardsPicker
                          tables={activeTemplate.tables}
                          onPick={(mesa) => void handleAsignarMesa(mesa)}
                          disabled={asignando}
                        />
                      </div>
                    )}
                  </div>
                )}

                {!buscando && resultado?.tipo === "ya_escaneada" && (
                  <div className="flex flex-col items-center gap-2">
                    <IconTile tone="reserved" size="xl">
                      <AlertTriangle size={26} />
                    </IconTile>
                    <p className="text-base font-medium text-fg">
                      {resultado.reservacion.clienteNombre}
                    </p>
                    {resultado.reservacion.mesaEtiqueta && (
                      <Badge tone="reserved" className="font-mono text-base tabular-nums">
                        <Armchair size={14} /> Mesa {resultado.reservacion.mesaEtiqueta}
                      </Badge>
                    )}
                    <p className="max-w-xs text-sm text-status-reserved-fg">
                      Esta reserva ya fue escaneada — el cliente ya está sentado.
                    </p>
                  </div>
                )}

                {!buscando && resultado?.tipo === "inactiva" && (
                  <div className="flex flex-col items-center gap-2">
                    <IconTile tone="danger" size="xl">
                      <AlertTriangle size={26} />
                    </IconTile>
                    <p className="text-base font-medium text-fg">
                      {resultado.reservacion.clienteNombre}
                    </p>
                    <p className="max-w-xs text-sm text-danger">
                      Esta reserva ya no está activa (
                      {resultado.reservacion.estado === "cancelada" ? "cancelada" : "no se presentó"}
                      ).
                    </p>
                  </div>
                )}

                {!buscando && resultado?.tipo === "no_encontrada" && (
                  <div className="flex flex-col items-center gap-2">
                    <IconTile tone="danger" size="xl">
                      <AlertTriangle size={26} />
                    </IconTile>
                    <p className="text-base font-medium text-fg">Cliente no registrado</p>
                    <p className="max-w-xs text-[12px] text-fg-subtle">
                      Ese código no corresponde a ninguna reserva.
                    </p>
                  </div>
                )}

                {!buscando && resultado?.tipo === "error" && (
                  <div className="flex flex-col items-center gap-2">
                    <IconTile tone="danger" size="xl">
                      <AlertTriangle size={26} />
                    </IconTile>
                    <p className="max-w-xs text-sm text-danger">{resultado.mensaje}</p>
                  </div>
                )}

                {resultado && !buscando && (
                  <Button onClick={handleSiguiente} className="mt-2" disabled={asignando}>
                    Escanear siguiente cliente
                  </Button>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
