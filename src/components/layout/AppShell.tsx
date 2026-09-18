import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TasaBar } from "./TasaBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useFloorPlanBootstrap } from "@/lib/useFloorPlanStore";
import { useComandaBootstrap } from "@/lib/useComandaStore";
import { useAlertaCocinaBootstrap } from "@/lib/useAlertaCocina";
import { usePushSubscriptionBootstrap } from "@/lib/pushSubscription";
import { useRestauranteBootstrap } from "@/lib/useRestauranteStore";

export function AppShell() {
  // Nombre, logo y moneda de visualización del negocio: se cargan una sola
  // vez aquí y de ahí los lee toda la app (DualPrice, el ticket, la tarjeta
  // de WhatsApp) — ver `useRestauranteStore.ts`.
  useRestauranteBootstrap();
  // El plano (salón, plantillas y mesas reales) lo leen Mesas, Mesero,
  // Reservaciones y Comandas. Se carga una sola vez aquí, en el shell de staff,
  // para que ninguna pantalla trabaje con mesas sin `mesaId` real.
  useFloorPlanBootstrap();
  // Cola de despacho y cuentas por cobrar: alimentan los badges de
  // navegación (Sidebar + MobileBottomNav), visibles desde cualquier
  // pantalla — ver el comentario del hook en `useComandaStore.ts`.
  useComandaBootstrap();
  // La alarma de pedidos nuevos vive aquí y no en la pantalla de despacho: si
  // colgara de esa pantalla, salir de ella desmontaría al único que escucha y
  // el cocinero parado en Mesas o en Cuentas no se enteraría de nada.
  useAlertaCocinaBootstrap();
  // Revalida la suscripción push del dispositivo en cada arranque (sólo si
  // ya hay permiso concedido) — el navegador puede rotar el endpoint sin
  // avisar, y esto es lo único que le vuelve a avisar al backend. Ver
  // `src/lib/pushSubscription.ts`. No sustituye la alarma in-app de arriba:
  // esa suena con la app abierta en cualquier pantalla, esto es lo que
  // llega con la app cerrada del todo.
  usePushSubscriptionBootstrap();

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      {/* Campo ambiental: dos manchas de gradiente en movimiento muy lento
          detrás de toda la app. Es la versión barata del fondo animado del
          proyecto de referencia — allí se interpola la propiedad `background`
          de una capa a pantalla completa, lo que repinta cada frame; aquí son
          dos pseudo-elementos estáticos movidos con `transform`, así que viven
          en el compositor y no cuestan repintado. Importa: esta app corre en
          tablets de host-stand. Ver `.ambient-field` en `global.css`. */}
      <div className="ambient-field" aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Franja de tasas y barra de navegación mobile: ambas viven en el
          flujo normal del `flex-col` (ninguna es `position: fixed`), así que
          apilan sin solaparse y el AppShell les reserva espacio automática-
          mente — `main` sigue acotado por `h-dvh` + `overflow-hidden` arriba,
          por lo que ninguna pantalla con scroll propio queda tapada. La tasa
          va primero (información de consulta), la navegación al final
          (acción, debe quedar más cerca del pulgar). En `md`+ la navegación
          vuelve a vivir en `Sidebar` y `MobileBottomNav` no renderiza nada
          visible (`md:hidden`). */}
      <div className="relative z-10">
        <TasaBar />
        <MobileBottomNav />
      </div>
    </div>
  );
}
