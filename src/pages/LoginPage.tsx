import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuthStore } from "@/lib/useAuthStore";

type Mode = "clave" | "pin";

/**
 * Staff login. Backend contract: `POST /api/v1/auth/login` with
 * `{ usuario, clave }`, or `POST /api/v1/auth/pin` with `{ usuario, pin }` —
 * both return `{ token, usuario }`. Mounted outside `ProtectedRoute`; once
 * signed in, `ProtectedRoute` sends the user back to wherever they were
 * headed (`location.state.from`), defaulting to `/mesas`.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const loginPin = useAuthStore((s) => s.loginPin);

  const [mode, setMode] = useState<Mode>("clave");
  const [usuario, setUsuario] = useState("");
  const [secreto, setSecreto] = useState("");

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/mesas";

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

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-bg px-4 py-8 text-fg">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5">
          <BrandMark size={40} />
          <span className="text-[20px] font-semibold uppercase tracking-wide text-fg">
            Coffee &amp; Cake
          </span>
        </div>
        <p className="text-[12px] text-fg-muted">para amantes del café</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col gap-4 py-6">
          <div>
            <h1 className="text-[16px] font-semibold text-fg">Iniciar sesión</h1>
            <p className="text-[13px] text-fg-muted">
              Ingresa con tu usuario y {mode === "clave" ? "clave" : "PIN"}.
            </p>
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
              autoComplete="current-password"
              value={secreto}
              onChange={(e) => setSecreto(e.target.value)}
              required
            />

            {error && <p className="text-[12px] text-danger">{error}</p>}

            <Button type="submit" variant="primary" disabled={status === "loading"}>
              {status === "loading" ? "Ingresando…" : "Ingresar"}
            </Button>

            <button
              type="button"
              className="text-[12px] text-fg-muted transition-colors duration-150 hover:text-fg"
              onClick={() => {
                setMode((m) => (m === "clave" ? "pin" : "clave"));
                setSecreto("");
              }}
            >
              {mode === "clave" ? "Ingresar con PIN en su lugar" : "Ingresar con clave en su lugar"}
            </button>
          </form>
        </CardBody>
      </Card>

      <div className="mt-6">
        <ThemeToggle />
      </div>
    </div>
  );
}
