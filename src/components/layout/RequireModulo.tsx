import { Navigate, Outlet } from "react-router-dom";
import type { ModuloApp } from "@/api";
import { useAuthStore } from "@/lib/useAuthStore";
import { primeraPantallaConcedida, usePuedeVer } from "@/lib/permisos";

/**
 * Guard de módulo, anidado DENTRO de `ProtectedRoute` (que ya garantiza que
 * hay sesión). Entrar a una ruta sin el módulo correspondiente —tecleada a
 * mano, un bookmark viejo, un enlace compartido— no muestra una página de
 * error: redirige a la primera pantalla que el usuario SÍ tiene, igual que la
 * home tras el login (`primeraPantallaConcedida`, misma función en los dos
 * sitios para que el destino nunca diverja).
 *
 * Mientras `modulosListos` sea `false` (sesión vieja recién cargada, esperando
 * `GET /auth/yo`), `usePuedeVer` es deliberadamente permisivo: la ruta se
 * renderiza igual. Si el refresco confirma que el módulo no era suyo, este
 * componente vuelve a evaluar (el store cambió) y redirige en ese momento —
 * una posible pantalla de más por una fracción de segundo, nunca "todo el
 * personal se queda afuera".
 */
export function RequireModulo({ modulo }: { modulo: ModuloApp }) {
  const usuario = useAuthStore((s) => s.usuario);
  const modulosListos = useAuthStore((s) => s.modulosListos);
  const puede = usePuedeVer(modulo);

  if (!puede) {
    return <Navigate to={primeraPantallaConcedida(usuario, modulosListos)} replace />;
  }

  return <Outlet />;
}
