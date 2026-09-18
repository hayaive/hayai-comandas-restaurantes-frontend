import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, LinkIcon } from "lucide-react";
import { m } from "framer-motion";

import { Card, CardBody } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuthStore } from "@/lib/useAuthStore";
import { primeraPantallaConcedida } from "@/lib/permisos";
import { useAppMotion } from "@/lib/useAppMotion";
import { formatDateTime } from "@/lib/format";
import { resolveMediaUrl } from "@/api/mediaUrl";
import { api, ApiError } from "@/api";
import type { ConsultarAccesoResult } from "@/api";

/**
 * Página pública de canje de un acceso temporal de mesero
 * (`/acceso/:slug#<token>`), FUERA de `ProtectedRoute` — igual que
 * `SelfSeatPage`, pensada para abrirse tal cual llega por WhatsApp, sin
 * sesión de ningún tipo. Reusa el lenguaje visual de `LoginPage` (campo
 * ambiental, marca, tarjeta flotante) porque es la otra puerta de entrada a
 * la app, no una pantalla de cliente como `SelfSeatPage`.
 *
 * El token va DETRÁS del `#` a propósito (ver CONTRACT.md): el navegador
 * nunca lo manda a ningún servidor, así que no queda en logs ni en el
 * Referer. Eso significa leerlo de `location.hash`, no de `useParams` ni de
 * la query string.
 */

type Estado =
  | "sin-token"
  | "cargando"
  | "no-encontrado"
  | "vencido"
  | "listo"
  | "error";

function leerTokenDelHash(): string {
  // WhatsApp a veces corta el enlace justo en el `#` (el brief lo señala
  // explícito): sin token, `location.hash` viene vacío y hay que decirlo
  // claro en vez de intentar una consulta que de todas formas fallaría.
  return window.location.hash.replace(/^#/, "");
}

export function AccesoPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const motionPrefs = useAppMotion();

  const usuarioSesion = useAuthStore((s) => s.usuario);
  const modulosListos = useAuthStore((s) => s.modulosListos);
  const canjearAcceso = useAuthStore((s) => s.canjearAcceso);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [token] = useState(leerTokenDelHash);
  const [estado, setEstado] = useState<Estado>(token ? "cargando" : "sin-token");
  const [datos, setDatos] = useState<ConsultarAccesoResult | null>(null);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [canjeando, setCanjeando] = useState(false);
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const codigoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelado = false;

    async function run() {
      try {
        const resultado = await api.consultarAcceso({ restaurante: slug, token });
        if (cancelado) return;
        setDatos(resultado);
        setEstado("listo");
      } catch (err) {
        if (cancelado) return;
        if (err instanceof ApiError && err.status === 404) {
          setEstado("no-encontrado");
        } else if (err instanceof ApiError && err.status === 410) {
          setEstado("vencido");
        } else {
          setEstado("error");
          setErrorMensaje(err instanceof ApiError ? err.message : "Ocurrió un error inesperado.");
        }
      }
    }
    void run();
    return () => {
      cancelado = true;
    };
  }, [slug, token]);

  // Una vez entrado, borra el token de la barra ANTES de navegar — decisión
  // explícita del brief: el fragmento no debe quedar visible ni en el
  // historial de esta pestaña más de lo necesario.
  useEffect(() => {
    if (!isAuthenticated) return;
    window.history.replaceState(null, "", window.location.pathname);
    navigate(primeraPantallaConcedida(usuarioSesion, modulosListos), { replace: true });
  }, [isAuthenticated, navigate, usuarioSesion, modulosListos]);

  function handleCodigoChange(event: ChangeEvent<HTMLInputElement>) {
    const soloDigitos = event.target.value.replace(/\D/g, "").slice(0, 4);
    setCodigo(soloDigitos);
    setCodigoError(null);
    if (soloDigitos.length === 4) void intentarCanje(soloDigitos);
  }

  async function intentarCanje(codigoCompleto: string) {
    setCanjeando(true);
    setCodigoError(null);
    try {
      await canjearAcceso(slug, token, codigoCompleto);
      // El `useEffect` de arriba hace la navegación en cuanto `isAuthenticated` cambie.
    } catch (err) {
      // Sin bloqueos ni esperas (decisión del dueño): se deja reintentar de
      // inmediato, nunca se deshabilita el campo por un tiempo fijo.
      if (err instanceof ApiError && err.status === 401) {
        setCodigoError("Código incorrecto");
        setCodigo("");
        codigoInputRef.current?.focus();
      } else if (err instanceof ApiError && err.status === 404) {
        setEstado("no-encontrado");
      } else if (err instanceof ApiError && err.status === 410) {
        setEstado("vencido");
      } else {
        setCodigoError(err instanceof ApiError ? err.message : "No se pudo canjear el código.");
      }
    } finally {
      setCanjeando(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-bg px-4 py-10 text-fg">
      <div className="ambient-field" aria-hidden="true" />

      <m.div
        variants={motionPrefs.rise}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        {estado === "listo" && datos ? (
          <RestauranteHeader restaurante={datos.restaurante} />
        ) : (
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-surface-hover text-fg-muted shadow-[var(--shadow-token-md)]">
              <LinkIcon size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight text-fg">Acceso de mesero</h1>
              <p className="text-sm text-fg-muted">Hayai Comandas</p>
            </div>
          </div>
        )}

        <Card className="w-full shadow-[var(--shadow-token-lg)]">
          <CardBody className="flex flex-col gap-5">
            {estado === "sin-token" && (
              <MensajeEstado
                titulo="Este enlace está incompleto"
                descripcion="Pídele al encargado que te lo reenvíe."
              />
            )}

            {estado === "cargando" && (
              <p className="py-6 text-center text-sm text-fg-muted">Verificando tu acceso…</p>
            )}

            {estado === "no-encontrado" && (
              <MensajeEstado titulo="Este enlace no es válido" descripcion="Revísalo con el encargado." />
            )}

            {estado === "vencido" && (
              <MensajeEstado
                titulo="Este acceso ya venció"
                descripcion="Pídele uno nuevo al encargado."
              />
            )}

            {estado === "error" && (
              <MensajeEstado
                titulo="No se pudo verificar el enlace"
                descripcion={errorMensaje ?? "Intenta de nuevo en un momento."}
              />
            )}

            {estado === "listo" && datos && (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-fg">Hola, {datos.nombre}</h2>
                  <p className="text-sm text-fg-muted">
                    Tu acceso vale hasta {formatDateTime(datos.accesoHasta)}.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Input
                    ref={codigoInputRef}
                    label="Código de 4 dígitos"
                    // Pensado para el pulgar: teclado numérico del sistema y el
                    // autocompletado de OTP de iOS/Android si el código llegó por
                    // SMS a la vez — aquí siempre llega por WhatsApp, pero el
                    // atributo no hace daño y algunos navegadores igual lo usan
                    // para sugerir el último código copiado.
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={codigo}
                    onChange={handleCodigoChange}
                    disabled={canjeando}
                    error={codigoError ?? undefined}
                    autoFocus
                    className="text-center font-mono text-2xl tracking-[0.5em]"
                  />
                  {canjeando && (
                    <p className="text-center text-[12px] text-fg-subtle">Entrando…</p>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <div className="mt-6">
          <ThemeToggle />
        </div>
      </m.div>
    </div>
  );
}

function MensajeEstado({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <IconTile tone="danger" size="xl">
        <AlertTriangle size={26} />
      </IconTile>
      <p className="text-lg font-semibold text-fg">{titulo}</p>
      <p className="max-w-[32ch] text-sm text-fg-muted">{descripcion}</p>
    </div>
  );
}

/** Iniciales del nombre del restaurante, respaldo cuando no hay logo — nunca un `<img>` roto. */
function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  return palabras
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function RestauranteHeader({
  restaurante,
}: {
  restaurante: ConsultarAccesoResult["restaurante"];
}) {
  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center">
      <div className="size-16 overflow-hidden rounded-full bg-surface-hover shadow-[var(--shadow-token-md)] ring-1 ring-black/10">
        {restaurante.logoUrl ? (
          <img
            src={resolveMediaUrl(restaurante.logoUrl)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-fg-muted">
            {inicialesDe(restaurante.nombre)}
          </span>
        )}
      </div>
      <div>
        <h1 className="text-2xl font-semibold leading-tight text-fg">{restaurante.nombre}</h1>
        <p className="text-sm text-fg-muted">Acceso de mesero</p>
      </div>
    </div>
  );
}
