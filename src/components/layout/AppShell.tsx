import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TasaBar } from "./TasaBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useFloorPlanBootstrap } from "@/lib/useFloorPlanStore";

export function AppShell() {
  // El plano (salón, plantillas y mesas reales) lo leen Mesas, Mesero,
  // Reservaciones y Comandas. Se carga una sola vez aquí, en el shell de staff,
  // para que ninguna pantalla trabaje con mesas sin `mesaId` real.
  useFloorPlanBootstrap();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
      <TasaBar />
      <MobileBottomNav />
    </div>
  );
}
