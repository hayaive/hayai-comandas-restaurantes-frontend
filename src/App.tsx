import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { RequireModulo } from "@/components/layout/RequireModulo";
import { PwaUpdateBanner } from "@/components/shared/PwaUpdateBanner";
import { useAuthStore } from "@/lib/useAuthStore";
import { primeraPantallaConcedida } from "@/lib/permisos";
import { FloorPlanPage } from "@/pages/FloorPlanPage";
import { MeseroPage } from "@/pages/MeseroPage";
import { ComandasPage } from "@/pages/ComandasPage";
import { CuentasPorCobrarPage } from "@/pages/CuentasPorCobrarPage";
import { VentasPage } from "@/pages/VentasPage";
import { ReservacionesPage } from "@/pages/ReservacionesPage";
import { ProductosPage } from "@/pages/ProductosPage";
import { ConfiguracionPage } from "@/pages/ConfiguracionPage";
import { MeserosPage } from "@/pages/MeserosPage";
import { CheckInPage } from "@/pages/CheckInPage";
import { EscanearPage } from "@/pages/EscanearPage";
import { SelfSeatPage } from "@/pages/SelfSeatPage";
import { AccesoPage } from "@/pages/AccesoPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

/**
 * Pantalla de inicio tras entrar por `/` (o por el índice de `AppShell`).
 * Antes era un `<Navigate to="/mesas" />` fijo — roto para un mesero temporal
 * sin ese módulo. Usa la misma `primeraPantallaConcedida` que el guard de
 * rutas y el post-login/post-canje, para que el destino nunca diverja.
 */
function HomeRedirect() {
  const usuario = useAuthStore((s) => s.usuario);
  const modulosListos = useAuthStore((s) => s.modulosListos);
  return <Navigate to={primeraPantallaConcedida(usuario, modulosListos)} replace />;
}

export function App() {
  return (
    <>
      <Routes>
        {/* Público — sin sidebar de staff, pensado para abrirse en el teléfono del cliente. */}
        <Route path="/reservar/:codigoPublico" element={<SelfSeatPage />} />
        {/* Canje de acceso temporal de mesero — igual de público, token en el `#`. */}
        <Route path="/acceso/:slug" element={<AccesoPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<HomeRedirect />} />
            <Route element={<RequireModulo modulo="mesas" />}>
              <Route path="/mesas" element={<FloorPlanPage />} />
            </Route>
            <Route element={<RequireModulo modulo="mesero" />}>
              <Route path="/mesero" element={<MeseroPage />} />
            </Route>
            <Route element={<RequireModulo modulo="despacho" />}>
              <Route path="/comandas" element={<ComandasPage />} />
            </Route>
            <Route element={<RequireModulo modulo="por_cobrar" />}>
              <Route path="/cuentas" element={<CuentasPorCobrarPage />} />
            </Route>
            <Route element={<RequireModulo modulo="ventas" />}>
              <Route path="/ventas" element={<VentasPage />} />
            </Route>
            <Route element={<RequireModulo modulo="reservaciones" />}>
              <Route path="/reservaciones" element={<ReservacionesPage />} />
            </Route>
            <Route element={<RequireModulo modulo="productos" />}>
              <Route path="/productos" element={<ProductosPage />} />
            </Route>
            {/* Sólo administrador: nadie más recibe estos dos módulos. */}
            <Route element={<RequireModulo modulo="configuracion" />}>
              <Route path="/configuracion" element={<ConfiguracionPage />} />
            </Route>
            <Route element={<RequireModulo modulo="meseros" />}>
              <Route path="/meseros" element={<MeserosPage />} />
            </Route>
            <Route element={<RequireModulo modulo="checkin" />}>
              <Route path="/checkin" element={<CheckInPage />} />
            </Route>
            <Route element={<RequireModulo modulo="escanear" />}>
              <Route path="/escanear" element={<EscanearPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      {/* App-wide: a new deploy's service worker install shows an explicit
          "update available" affordance rather than swapping the shell
          silently mid-service. See vite.config.ts's `registerType: 'prompt'`
          comment. */}
      <PwaUpdateBanner />
    </>
  );
}
