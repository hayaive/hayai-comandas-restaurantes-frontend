import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { AlertTriangle } from "lucide-react";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconTile } from "@/components/ui/IconTile";
import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuthStore } from "@/lib/useAuthStore";
import { primeraPantallaConcedida } from "@/lib/permisos";
import { useAppMotion } from "@/lib/useAppMotion";
import { cn } from "@/lib/cn";
import * as authApi from "@/api/auth";

type Mode = "clave" | "pin";

/**
 * Staff login. Backend contract: `POST /api/v1/auth/login` with
 * `{ usuario, clave }`, or `POST /api/v1/auth/pin` with `{ usuario, pin }` —
 * both return `{ token, usuario }`. Mounted outside `ProtectedRoute`; once
 * signed in, `ProtectedRoute` sends the user back to wherever they were
 * headed (`location.state.from`), defaulting to `/mesas`.
 *
 * Visually this is the first thing anyone sees, so it carries the full
 * treatment: the ambient gradient field behind, the brand mark on its
 * gradient tile, and a 24px card floating on top. The clave/PIN switch is a
 * real segmented control now rather than a text link — two modes of equal
 * standing deserve a visible pair, and its selected segment is the brown the
 * client asked for, which also introduces the rule on the very first screen.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const motionPrefs = useAppMotion();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const loginPin = useAuthStore((s) => s.loginPin);
  const usuarioSesion = useAuthStore((s) => s.usuario);
  const modulosListos = useAuthStore((s) => s.modulosListos);

  const [mode, setMode] = useState<Mode>("clave");
  const [usuario, setUsuario] = useState("");
  const [secreto, setSecreto] = useState("");

  // Se lee UNA sola vez (función de inicialización de `useState`, no en un
  // efecto): `tomarAvisoAccesoVencido` CONSUME la bandera, así que leerla en
  // cada render la borraría antes de que el componente llegue a pintarla.
  const [accesoVencido] = useState(() => authApi.tomarAvisoAccesoVencido());

  // Antes fijo en "/mesas" — roto para cualquiera sin ese módulo (un
  // encargado sin Mesas, un mesero temporal). La pantalla de inicio tras el
  // login es la primera pantalla concedida, la misma función que usa el
  // guard de rutas (`primeraPantallaConcedida`) para que nunca diverjan.
  const stateFrom = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const from = stateFrom ?? primeraPantallaConcedida(usuarioSesion, modulosListos);

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (mode === "clave") {
        await login(usuario, secreto);
      } else {
        await loginPin(usuario, secreto);
      }
    } catch {
      // El mensaje de error ya queda reflejado por el store en `error`.
    }
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setSecreto("");
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
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={64} className="rounded-full shadow-[var(--shadow-token-md)]" />
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-fg">Coffee &amp; Cake</h1>
            <p className="text-sm text-fg-muted">para amantes del café</p>
          </div>
        </div>

        {accesoVencido ? (
          // Un acceso temporal vencido a mitad de turno cae aquí (401 →
          // `handleUnauthorized` deja el aviso, ver `src/api/auth.ts`). Ese
          // mesero no tiene usuario ni clave: mostrarle el formulario normal
          // no le sirve de nada, así que la tarjeta entera se reemplaza por
          // este mensaje en vez de mezclarlo con el login.
          <Card className="w-full shadow-[var(--shadow-token-lg)]">
            <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
              <IconTile tone="danger" size="xl">
                <AlertTriangle size={26} />
              </IconTile>
              <h2 className="text-lg font-semibold text-fg">Tu acceso terminó</h2>
              <p className="max-w-[32ch] text-sm text-fg-muted">
                Pídele un enlace nuevo al encargado.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card className="w-full shadow-[var(--shadow-token-lg)]">
            <CardBody className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-fg">Iniciar sesión</h2>
                <p className="text-sm text-fg-muted">
                  Ingresa con tu usuario y {mode === "clave" ? "clave" : "PIN"}.
                </p>
              </div>

              {/* Segmented control. `role="tablist"` would be wrong — these do not
                  reveal panels; they change what the second field means. A plain
                  pair of buttons with `aria-pressed` says exactly that. */}
              <div className="flex gap-1 rounded-[var(--radius-md)] bg-surface-sunken p-1">
                {(["clave", "pin"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => switchMode(value)}
                    className={cn(
                      "flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium",
                      "transition-colors duration-150",
                      mode === value
                        ? "bg-active text-active-fg shadow-[var(--shadow-token-sm)]"
                        : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {value === "clave" ? "Con clave" : "Con PIN"}
                  </button>
                ))}
              </div>

              <form className="flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
                <Input
                  label="Usuario"
                  autoComplete="username"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  autoFocus
                />
                <Input
                  label={mode === "clave" ? "Clave" : "PIN"}
                  type="password"
                  inputMode={mode === "pin" ? "numeric" : undefined}
                  autoComplete="current-password"
                  value={secreto}
                  onChange={(e) => setSecreto(e.target.value)}
                  required
                />

                {error && (
                  <p
                    role="alert"
                    className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="mt-1 w-full"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Ingresando…" : "Ingresar"}
                </Button>
              </form>
            </CardBody>
          </Card>
        )}

        <div className="mt-6">
          <ThemeToggle />
        </div>
      </m.div>
    </div>
  );
}
